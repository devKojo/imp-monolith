export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

/** SSR-friendly fetch of users from the API. */
export const useUsers = () => {
  const {
    public: { apiBase },
  } = useRuntimeConfig();
  return useFetch<User[]>('/users', { baseURL: apiBase, default: () => [] });
};
