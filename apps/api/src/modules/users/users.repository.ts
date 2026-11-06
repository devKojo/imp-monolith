import type { User } from './users.schemas';

export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | undefined>;
  findByEmail(email: string): Promise<User | undefined>;
  list(): Promise<User[]>;
}

/** Placeholder persistence; swap for a real DB implementation. */
export class InMemoryUserRepository implements UserRepository {
  private store = new Map<string, User>();
  async save(user: User) {
    this.store.set(user.id, user);
  }
  async findById(id: string) {
    return this.store.get(id);
  }
  async findByEmail(email: string) {
    return [...this.store.values()].find((u) => u.email === email);
  }
  async list() {
    return [...this.store.values()];
  }
}
