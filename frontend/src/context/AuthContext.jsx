import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  loginUser,
  registerUser,
} from "../services/authService";
import { UNAUTHORIZED_EVENT } from "../services/apiClient";

const AuthContext = createContext(null);

const TOKEN_KEY = "cybercup_token";
const USER_KEY = "cybercup_user";

function readStoredUser() {
  try {
    const stored = sessionStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function readStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(readStoredToken);

  const logout = useCallback(() => {
    try {
      sessionStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(USER_KEY);
    } catch {
      // storage unavailable: state reset below is enough
    }
    setToken(null);
    setUser(null);
  }, []);

  // Any API call that returns 401 (expired token) signs the user out.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, logout);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout);
  }, [logout]);

  async function login(email, password) {
    const data = await loginUser(email, password);
    const profile = {
      userId: data.userId,
      fullName: data.fullName,
      email: data.email,
      roles: data.roles,
      department: data.department,
      clearance: data.clearance,
    };

    try {
      sessionStorage.setItem(TOKEN_KEY, data.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(profile));
    } catch {
      // keep the session in memory only
    }

    setToken(data.token);
    setUser(profile);
    return data;
  }

  async function register(fullName, email, password) {
    return registerUser(fullName, email, password);
  }

  const roles = user?.roles || [];
  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
    isAdmin: roles.includes("ADMIN"),
    isMonitor: roles.includes("ADMIN") || roles.includes("SECURITY_ANALYST"),
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
