export interface SocialUser {
  id: string;
  name: string;
  image: string | null;
}

export interface PaginatedUsers {
  data: SocialUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SocialRepository {
  userExists(userId: string): Promise<boolean>;
  follow(followerId: string, followingId: string): Promise<void>;
  unfollow(followerId: string, followingId: string): Promise<void>;
  getFollowers(userId: string, page: number, limit: number): Promise<PaginatedUsers>;
  getFollowing(userId: string, page: number, limit: number): Promise<PaginatedUsers>;
}
