
import {
  createContext,
  useContext,
  useState,
} from "react";
import {
  loginUser,
  registerUser,
} from "../services/authService";

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

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(
    () => sessionStorage.getItem(TOKEN_KEY)
  );

  async function login(email, password) {
    const data = await loginUser(email, password);

    sessionStorage.setItem(TOKEN_KEY, data.token);
    sessionStorage.setItem(
      USER_KEY,
      JSON.stringify({
        userId: data.userId,
        fullName: data.fullName,
        email: data.email,
        roles: data.roles,
      })
    );

    setToken(data.token);
    setUser({
      userId: data.userId,
      fullName: data.fullName,
      email: data.email,
      roles: data.roles,
    });

    return data;
  }

  async function register(fullName, email, password) {
    return registerUser(fullName, email, password);
  }

  function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }

  const value = {
    user,
    token,
    isAuthenticated: Boolean(token && user),
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

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider"
    );
  }

  return context;
}
