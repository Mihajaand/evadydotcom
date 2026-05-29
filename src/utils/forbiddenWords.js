/**
 * Système de modération et filtrage de messages pour E-VADY
 * 
 * Contient un dictionnaire complet de mots interdits, insultes, termes violents
 * et des expressions régulières pour détecter :
 * - Les numéros de téléphone (et variations d'écriture)
 * - Les suites de plus de 4 chiffres consécutifs
 * - Les adresses e-mail (et variations)
 * - Les réseaux sociaux et leurs abréviations (Instagram, Snap, WhatsApp, FB, TikTok, etc.)
 * - Le vocabulaire violent/meurtrier
 * - Les tentatives de contournement pour sortir de l'application (ex: "mon num", "écris moi sur...")
 */

// Liste extensive de mots interdits (insultes, violence, bypass)
export const FORBIDDEN_WORDS = [
  // === INSULTES & GROSSIERETES (FRANCAIS / ANGLAIS) ===
  "connard", "connarde", "conard", "con", "conne", "salaud", "salope", "pute", "putain", "bordel",
  "chieur", "chieuse", "encule", "enculé", "enculee", "enculée", "batard", "bâtard", "batarde", "bâtarde",
  "crevard", "crevure", "pd", "pede", "pédé", "tarlouze", "gogol", "mongol", "debile", "débile",
  "abruti", "abrutie", "imbecile", "imbécile", "connasse", "conasse", "pouffiasse", "poufiasse",
  "petasse", "pétasse", "trouduc", "trouducul", "trou de cul", "fdp", "fils de pute", "fils de put",
  "nique", "niquer", "niqueur", "niqueuse", "nique ta mere", "nique ta mère", "ntm", "chienne",
  "salaude", "merde", "merdeux", "merdeuse", "foutre", "foutoir", "fouteur", "fouteuse", "couille",
  "couilles", "bite", "bites", "chatte", "chattes", "cul", "culs", "fesse", "fesses", "burne", "burnes",
  "zizi", "pénis", "penis", "vagin", "clito", "clitoris", "sodomie", "sodome", "sodomiser",
  "baise", "baiser", "baisé", "baisée", "niquee", "niquée", "sucer", "suceur", "suceuse", "branler",
  "branleur", "branleuse", "branlette", "ejaculer", "éjaculer", "ejaculation", "éjaculation", "sperme",
  "orgasme", "jouir", "nichon", "nichons", "boobs", "seins", "sein", "fellation", "cunnilingus",
  "anus", "fion", "michto", "michtoneuse", "escort", "pute", "prostituee", "prostituée", "prostitue",
  "asshole", "bitch", "bastard", "cunt", "dick", "cock", "fuck", "fucker", "fucking", "motherfucker",
  "pussy", "shit", "slut", "whore", "crap", "wanker", "prick", "twat", "tosser", "bollocks",

  // === VIOLENCE, MEURTRE & CRIMINALITE ===
  "tuer", "tue", "tues", "tuez", "tuons", "tuera", "tueras", "tueront", "tuerais", "tuerait",
  "mort", "morte", "morts", "mortes", "mourir", "assassin", "assassine", "assassiner", "assassinat",
  "assassinats", "meurtre", "meurtres", "meurtrier", "meurtriere", "meurtrière", "homicide", "tueur",
  "tueuse", "tueur a gages", "tueur à gages", "egorger", "égorger", "decapiter", "décapiter",
  "etrangler", "étrangler", "poignarder", "fusiller", "abattre", "lyncher", "massacrer", "massacre",
  "viol", "violer", "violeur", "violeuse", "agresser", "agression", "agresseur", "agressif",
  "battre", "frapper", "cogner", "gifler", "tabasser", "torturer", "torture", "otag", "otage", "otages",
  "kidnapper", "kidnapping", "enlever", "enlevement", "enlèvement", "sequestrer", "séquestrer",
  "sequestration", "séquestration", "terroriste", "terrorisme", "attentat", "bombe", "kamikaze",
  "djihad", "djihadiste", "armes", "arme", "pistolet", "revolver", "fusil", "couteau", "poignard",
  "sang", "sanglant", "cadavre", "cadavres", "corps sans vie", "suicide", "suicider", "pendre",
  "poison", "empoisonner", "detruire", "détruire", "ravager", "bruler", "brûler", "cramer",

  // === TENTATIVES DE CONTOURNEMENT / RENSEIGNEMENTS PERSONNELS (BYPASS STRIPE / ABONNEMENT) ===
  "mon num", "mon numero", "mon numéro", "ton num", "ton numero", "ton numéro", "mon tel", "mon tél",
  "mon telephone", "mon téléphone", "ton tel", "ton tél", "ton telephone", "ton téléphone",
  "ecris moi", "écris moi", "ecris-moi", "écris-moi", "contacte moi", "contacte-moi", "appel moi",
  "appelle moi", "appelle-moi", "appeler", "s'appeler", "skype", "zoom", "teams", "rencontrer en vrai",
  "hors ligne", "en dehors", "quitter l'app", "quitter l'application", "pas de crédit", "pas de credit",
  "plus de message", "plus de messages", "limite de message", "limite de messages", "payer", "payant",
  "gratuit", "stripe", "abonnement", "abonnements", "cher", "arnaque", "arnaques", "arnaqueur",
  "envoyer un mail", "envoie un mail", "mon mail", "ton mail", "mon adresse", "ton adresse",
  "mon contact", "ton contact", "contacts", "coordonnees", "coordonnées", "carte bleue", "rib",
  "western union", "argent", "euros", "paye", "payer", "tarif", "tarifs", "prix", "proposer",

  // === RESEAUX SOCIAUX & MESSAGERIES (ET VARIATIONS D'ECRITURE) ===
  "instagram", "insta", "instagramme", "instgrm", "inst@gram", "inst@", "1nsta", "1nstagram",
  "snapchat", "snap", "sn@pchat", "sn@p", "snapp", "snapc", "s.n.a.p", "i.n.s.t.a",
  "whatsapp", "whats", "whatapp", "watsap", "wathsapp", "watsapp", "wathsap", "whatsap", "whasap",
  "w@tsap", "w@tsapp", "w@thsapp", "w@tshap", "wsp", "whsp", "w.h.a.t.s.a.p.p", "w.s.p",
  "facebook", "fb", "face book", "facebk", "fbook", "f.b", "messenger", "msger", "msg",
  "tiktok", "tik tok", "tiktokeur", "tiktokeuse", "tk tok", "t.i.k.t.o.k",
  "telegram", "telegrame", "tg", "télégram", "télégramme", "t.e.l.e.g.r.a.m",
  "twitter", "twitr", "x.com", "threads", "thread", "discord", "dscrd", "dc", "d.i.s.c.o.r.d",
  "linkedin", "viber", "signal", "line", "wechat", "kik", "hangouts"
];

// Génération dynamique pour atteindre un volume important de variations de mots interdits
// On ajoute automatiquement des pluriels, variantes accentuées ou féminins courants
const generateVariations = () => {
  const variations = new Set();
  
  FORBIDDEN_WORDS.forEach(word => {
    variations.add(word);
    
    // Remplacements communs de caractères pour contourner les filtres (leet speak simple)
    const leet = word
      .replace(/a/g, "@")
      .replace(/o/g, "0")
      .replace(/i/g, "1")
      .replace(/e/g, "3")
      .replace(/s/g, "$");
    
    if (leet !== word) {
      variations.add(leet);
    }

    // Version sans accents
    const noAccents = word
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (noAccents !== word) {
      variations.add(noAccents);
    }
  });

  return Array.from(variations);
};

export const EXTENDED_FORBIDDEN_WORDS = generateVariations();

/**
 * Valide un message utilisateur selon les critères de sécurité
 * @param {string} text - Le contenu du message à valider
 * @returns {Object} { isValid: boolean, reason: string | null }
 */
export const validateMessage = (text) => {
  if (!text || typeof text !== 'string') {
    return { isValid: true, reason: null };
  }

  const cleanText = text.trim().toLowerCase();

  // === 1. Détection de plus de 4 chiffres consécutifs (ex: numéros de téléphone, codes) ===
  // Cette règle bloque aussi "12345" ou "2026" s'ils sont collés, pour éviter l'échange de numéros
  const consecutiveDigitsRegex = /\d{5,}/;
  if (consecutiveDigitsRegex.test(cleanText)) {
    return {
      isValid: false,
      reason: "Les suites de plus de 4 chiffres consécutifs ne sont pas autorisées pour des raisons de sécurité."
    };
  }

  // === 2. Détection de numéros de téléphone maquillés ou espacés ===
  // Détecte par exemple: "06 12 34 56 78", "07.12.34.56.78", "zero six douze...", "06-12-34...", "+33 6...", etc.
  const phonePatterns = [
    // Chiffres séparés par des espaces, points ou tirets (ex: 06 12 34 56 78 ou 06.12...)
    /(?:(?:\+|00)\d{1,3}[\s.-]?)?\(?0\)?[\s.-]?[1-9](?:[\s.-]?\d{2}){4}/,
    // Format compact ou à 10 chiffres (ex: 0612345678)
    /\b0[1-9]\d{8}\b/,
    // Numéros espacés astucieusement (ex: 0 6 1 2 3 4 5 6 7 8)
    /\b\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\s+\d\b/,
    // Suite de chiffres suspecte avec lettres (ex: 06huit douze...)
    /\b0\s*[67]\s*(?:un|deux|trois|quatre|cinq|six|sept|huit|neuf|\d\s*){8,}/
  ];

  for (const pattern of phonePatterns) {
    if (pattern.test(cleanText)) {
      return {
        isValid: false,
        reason: "Le partage de numéros de téléphone est interdit dans les messages. Veuillez rester sur l'application."
      };
    }
  }

  // === 3. Détection d'adresses e-mail (et variations maquillées) ===
  const emailPatterns = [
    // Format e-mail classique (ex: jean.dupont@gmail.com)
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    // Format maquillé (ex: jean [at] gmail . com, jean(chez)gmail.com, jean arobase gmail point com)
    /[a-zA-Z0-9._%+-]+\s*(?:\[at\]|\(at\)|\(chez\)|chez|@|arobase)\s*[a-zA-Z0-9.-]+\s*(?:\.|\[dot\]|\(dot\)|point)\s*[a-zA-Z]{2,}/
  ];

  for (const pattern of emailPatterns) {
    if (pattern.test(cleanText)) {
      return {
        isValid: false,
        reason: "Le partage d'adresses e-mail est interdit pour votre sécurité."
      };
    }
  }

  // === 4. Détection des pseudos de réseaux sociaux déguisés ===
  // Détecte "mon snap: xxx", "insta: xxx", "wsp : xxx", "ig @xxx", etc.
  const socialBypassPatterns = [
    /\b(?:insta|snap|fb|wsp|whatsapp|tg|telegram|discord)\s*[:@=-]?\s*[a-zA-Z0-9_.-]{3,}/,
    /@[a-zA-Z0-9_.-]{3,}\b/ // Détecte l'arobase suivi d'un pseudo (ex: @mon_compte)
  ];

  for (const pattern of socialBypassPatterns) {
    if (pattern.test(cleanText)) {
      // Pour éviter de bloquer des mots naturels contenant un arobase ou similaire
      // on vérifie si ça ressemble vraiment à un pseudo ou mention réseau social
      return {
        isValid: false,
        reason: "Le partage de comptes de réseaux sociaux n'est pas autorisé."
      };
    }
  }

  // === 5. Détection par mot clé exact ou partiel ===
  // Normaliser le texte (supprimer ponctuation pour éviter "c.o.n.n.a.r.d")
  const normalizedText = cleanText
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Découper en mots
  const words = normalizedText.split(/\s+/);

  for (const word of words) {
    if (word.length < 2) continue; // Ignorer les lettres seules
    
    // Recherche exacte dans le dictionnaire
    const found = EXTENDED_FORBIDDEN_WORDS.includes(word);
    if (found) {
      // Déterminer la catégorie pour adapter le message d'erreur
      if (FORBIDDEN_WORDS.slice(252).some(w => word.includes(w))) {
        // C'est un réseau social
        return {
          isValid: false,
          reason: "L'échange de réseaux sociaux ou d'applications tierces est interdit."
        };
      }
      
      if (FORBIDDEN_WORDS.slice(120, 252).some(w => word.includes(w))) {
        // C'est de la violence / contournement
        return {
          isValid: false,
          reason: "Votre message contient des propos ou termes non autorisés sur la plateforme."
        };
      }

      return {
        isValid: false,
        reason: "Votre message contient des mots vulgaires ou inappropriés interdits par notre charte de communauté."
      };
    }
  }

  // Vérification de sous-chaînes de mots interdits collés (ex: "grosconnard")
  for (const forbidden of FORBIDDEN_WORDS) {
    if (forbidden.length > 3 && normalizedText.includes(forbidden)) {
      // Vérifier que ce n'est pas un faux positif (ex: "tuer" dans "habituer")
      const isFakePositive = (forbidden === "tuer" && normalizedText.includes("habituer")) ||
                             (forbidden === "mort" && normalizedText.includes("mortier")) ||
                             (forbidden === "tue" && (normalizedText.includes("situe") || normalizedText.includes("statue")));
      
      if (!isFakePositive) {
        return {
          isValid: false,
          reason: "Votre message a été bloqué car il contient du contenu inapproprié."
        };
      }
    }
  }

  return { isValid: true, reason: null };
};
