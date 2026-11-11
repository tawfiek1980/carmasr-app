import type { User } from "../types";

const USER_KEY = "tareeq_user";

export const auth = {
  /**
   * حفظ المستخدم
   */
  setUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },

  /**
   * جلب المستخدم
   */
  getUser(): User | null {
    const data = localStorage.getItem(USER_KEY);

    if (!data) return null;

    try {
      return JSON.parse(data) as User;
    } catch (error) {
      console.error("Failed to parse user:", error);
      return null;
    }
  },

  /**
   * هل المستخدم مسجل دخول؟
   */
  isAuthenticated(): boolean {
    return this.getUser() !== null;
  },

  /**
   * هل المستخدم مدير؟
   */
  isAdmin(): boolean {
    const user = this.getUser();

    if (!user) return false;

    return user.type === "admin";
  },

  /**
   * نوع المستخدم
   */
  getRole(): User["type"] | null {
    const user = this.getUser();

    return user ? user.type : null;
  },

  /**
   * حذف الجلسة
   */
  logout(): void {
    localStorage.removeItem(USER_KEY);
  },

  /**
   * مسح البيانات بالكامل
   */
  clear(): void {
    localStorage.clear();
  },
};