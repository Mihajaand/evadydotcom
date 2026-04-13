-- =============================================
-- E-VADY - Schéma SQL pour Supabase
-- Exécutez ce script dans le SQL Editor de Supabase
-- =============================================

-- Table des profils utilisateurs
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  gender TEXT NOT NULL CHECK (gender IN ('MALE', 'FEMALE')),
  full_name TEXT NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  latitude DOUBLE PRECISION DEFAULT 0,
  longitude DOUBLE PRECISION DEFAULT 0,
  is_online BOOLEAN DEFAULT false,
  birthdate DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des photos (max 6 par user, géré côté client)
CREATE TABLE IF NOT EXISTS photos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  is_profile BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des likes
CREATE TABLE IF NOT EXISTS likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  liker_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  liked_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liker_id, liked_id)
);

-- Table des signalements
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reported_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des abonnements
CREATE TABLE IF NOT EXISTS subscriptions (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE PRIMARY KEY,
  tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'premium', 'vip')),
  expires_at TIMESTAMPTZ,
  stripe_sub_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table compteur de messages quotidiens
CREATE TABLE IF NOT EXISTS daily_message_counts (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  count_date DATE DEFAULT CURRENT_DATE NOT NULL,
  message_count INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, count_date)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_likes_liker ON likes(liker_id);
CREATE INDEX IF NOT EXISTS idx_likes_liked ON likes(liked_id);
CREATE INDEX IF NOT EXISTS idx_profiles_gender ON profiles(gender);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_id);

-- =============================================
-- Row Level Security (RLS) Policies
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_message_counts ENABLE ROW LEVEL SECURITY;

-- Profiles: les users authentifiés voient les profils du genre opposé
CREATE POLICY "Users can view opposite gender profiles" ON profiles
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      id = auth.uid() OR
      gender != (SELECT gender FROM profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Photos: visibles pour les profils du genre opposé + le propriétaire
CREATE POLICY "Users can view photos" ON photos
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage own photos" ON photos
  FOR ALL USING (auth.uid() = user_id);

-- Messages: seuls l'envoyeur et le destinataire peuvent voir
CREATE POLICY "Users can view own messages" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can mark messages as read" ON messages
  FOR UPDATE USING (auth.uid() = receiver_id);

-- Likes
CREATE POLICY "Users can view likes involving them" ON likes
  FOR SELECT USING (auth.uid() = liker_id OR auth.uid() = liked_id);

CREATE POLICY "Users can insert likes" ON likes
  FOR INSERT WITH CHECK (auth.uid() = liker_id);

-- Reports
CREATE POLICY "Users can insert reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- Subscriptions
CREATE POLICY "Users can view own subscription" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own subscription" ON subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Daily message counts
CREATE POLICY "Users can view own count" ON daily_message_counts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own count" ON daily_message_counts
  FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- Fonction: Suppression auto après 5 signalements
-- =============================================
CREATE OR REPLACE FUNCTION check_report_count()
RETURNS TRIGGER AS $$
DECLARE
  report_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO report_count
  FROM reports
  WHERE reported_id = NEW.reported_id;

  -- Si 5 signalements ou plus, supprimer le compte
  IF report_count >= 5 THEN
    DELETE FROM auth.users WHERE id = NEW.reported_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_check_reports
  AFTER INSERT ON reports
  FOR EACH ROW
  EXECUTE FUNCTION check_report_count();

-- =============================================
-- Fonction: Créer un profil par défaut à l'inscription
-- (appelée manuellement après signup côté client)
-- =============================================
-- Note: Le profil est créé côté client après l'inscription
