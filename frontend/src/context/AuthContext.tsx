import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';

// Global Axios Interceptor to always attach the latest token before any request
axios.interceptors.request.use((config) => {
    const token = localStorage.getItem('nexus_token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

interface UserPermission {
    agent_slug: string;
    module_slug: string | null;
}

interface User {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_admin: number;
    permissions: UserPermission[];
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (data: RegisterData) => Promise<void>;
    logout: () => void;
    hasAccess: (agentSlug: string, moduleSlug?: string) => boolean;
}

interface RegisterData {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
    role: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
    return ctx;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(localStorage.getItem("nexus_token"));
    const [isLoading, setIsLoading] = useState(true);

    // On mount: validate stored token
    useEffect(() => {
        if (token) {
            axios.get('/api/auth/me', {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => setUser(res.data))
                .catch(() => {
                    localStorage.removeItem("nexus_token");
                    setToken(null);
                    setUser(null);
                })
                .finally(() => setIsLoading(false));
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = async (email: string, password: string) => {
        const res = await axios.post('/api/auth/login', { email, password });
        const { access_token, user: userData } = res.data;
        localStorage.setItem("nexus_token", access_token);
        setToken(access_token);
        setUser(userData);
    };

    const register = async (data: RegisterData) => {
        const res = await axios.post('/api/auth/register', data);
        const { access_token, user: userData } = res.data;
        localStorage.setItem("nexus_token", access_token);
        setToken(access_token);
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem("nexus_token");
        setToken(null);
        setUser(null);
    };

    const hasAccess = (agentSlug: string, moduleSlug?: string): boolean => {
        if (!user) return false;
        if (user.is_admin === 1) return true;

        return user.permissions.some(p => {
            // Match agent
            if (p.agent_slug !== agentSlug) return false;
            // If permission has no module_slug, it grants access to entire agent
            if (p.module_slug === null) return true;
            // If checking specific module, match it
            if (moduleSlug && p.module_slug === moduleSlug) return true;
            // If no specific module requested, any permission on agent grants access
            if (!moduleSlug) return true;
            return false;
        });
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, hasAccess }}>
            {children}
        </AuthContext.Provider>
    );
};
