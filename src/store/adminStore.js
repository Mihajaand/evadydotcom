/**
 * Store Admin Zustand
 * Gère la session admin côté client uniquement (mémoire, non persisté)
 * Aucun appel Supabase Auth — identifiants hardcodés
 */
import { create } from 'zustand';

// Identifiants admin hardcodés
const ADMIN_LOGIN = 'MODE_GOD';
const ADMIN_PASSWORD = '538609MODE-GOD!';

const useAdminStore = create((set) => ({
  // État
  isAdminLoggedIn: false,

  /**
   * Connexion admin — vérifie les identifiants hardcodés
   * @returns {boolean} true si succès, false sinon
   */
  adminLogin: (login, password) => {
    if (login === ADMIN_LOGIN && password === ADMIN_PASSWORD) {
      set({ isAdminLoggedIn: true });
      return true;
    }
    return false;
  },

  /**
   * Déconnexion admin — remet l'état à false
   */
  adminLogout: () => {
    set({ isAdminLoggedIn: false });
  },
}));

export default useAdminStore;
