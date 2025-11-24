export type User = {
  id: string;
  email: string;
  name: string;
  roles: string[];
};

export const UserModel = {
  async verifyCredentials(email: string, _password: string): Promise<User | null> {
    // Placeholder authentication; replace with real user lookup if/when wiring this API.
    return { id: "mock-user", email, name: "Usuário", roles: [] };
  },
};

