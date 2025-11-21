export type User = {
  id: string;
  email: string;
  name: string;
  roles: string[];
};

class UserModelImpl {
  async verifyCredentials(email: string, password: string): Promise<User | null> {
    // TODO: plug real database logic (Postgres/Prisma/etc)
    if (email && password) {
      return { id: "demo", email, name: "Demo User", roles: ["admin"] };
    }
    return null;
  }
}

export const UserModel = new UserModelImpl();
