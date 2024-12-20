/**
 * @fileoverview Frontend service module for user management operations in the multi-tenant CRM system
 * Implements comprehensive user management with role-based access control and tenant isolation
 * @version 1.0.0
 */

import { AxiosResponse } from 'axios'; // ^1.4.0
import { debounce } from 'lodash'; // ^4.17.21
import { apiClient } from '../utils/api';
import { USER_ENDPOINTS } from '../constants/apiEndpoints';
import { IUser, IUserPreferences, UserStatus } from '../../../backend/src/interfaces/IUser';
import { ROLES } from '../../../backend/src/constants/roles';

/**
 * Interface for pagination parameters
 */
interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/**
 * Interface for user list filtering
 */
interface UserFilters {
  role?: ROLES;
  status?: UserStatus;
  search?: string;
  tenantId: string;
}

/**
 * Interface for paginated response
 */
interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Class implementing user management operations with tenant isolation
 */
export class UserService {
  /**
   * Debounced search function for user filtering
   */
  private static debouncedSearch = debounce(
    (searchTerm: string, callback: (results: IUser[]) => void) => {
      UserService.searchUsers(searchTerm).then(callback);
    },
    300
  );

  /**
   * Retrieves a paginated list of users with optional filters
   * @param filters - User filtering criteria
   * @param pagination - Pagination parameters
   * @returns Promise resolving to paginated user list
   */
  public static async fetchUsers(
    filters: UserFilters,
    pagination: PaginationParams
  ): Promise<PaginatedResponse<IUser>> {
    try {
      const queryParams = new URLSearchParams({
        page: pagination.page.toString(),
        pageSize: pagination.pageSize.toString(),
        sortBy: pagination.sortBy,
        sortOrder: pagination.sortOrder,
        ...(filters.role && { role: filters.role }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search })
      });

      const response = await apiClient.get<PaginatedResponse<IUser>>(
        `${USER_ENDPOINTS.GET_ALL}?${queryParams.toString()}`
      );

      return response;
    } catch (error) {
      throw new Error('Failed to fetch users');
    }
  }

  /**
   * Retrieves a specific user by ID
   * @param userId - User identifier
   * @returns Promise resolving to user details
   */
  public static async getUserById(userId: string): Promise<IUser> {
    try {
      const response = await apiClient.get<IUser>(
        USER_ENDPOINTS.GET_BY_ID.replace(':id', userId)
      );
      return response;
    } catch (error) {
      throw new Error('Failed to fetch user details');
    }
  }

  /**
   * Updates user profile information
   * @param userId - User identifier
   * @param updateData - Partial user data to update
   * @returns Promise resolving to updated user
   */
  public static async updateUserProfile(
    userId: string,
    updateData: Partial<IUser>
  ): Promise<IUser> {
    try {
      // Validate update data
      if (!userId || Object.keys(updateData).length === 0) {
        throw new Error('Invalid update data');
      }

      const response = await apiClient.put<IUser>(
        USER_ENDPOINTS.UPDATE_PROFILE,
        {
          userId,
          ...updateData
        }
      );

      return response;
    } catch (error) {
      throw new Error('Failed to update user profile');
    }
  }

  /**
   * Updates user preferences
   * @param preferences - User preference settings
   * @returns Promise resolving to updated preferences
   */
  public static async updateUserPreferences(
    preferences: Partial<IUserPreferences>
  ): Promise<IUserPreferences> {
    try {
      const response = await apiClient.put<IUserPreferences>(
        USER_ENDPOINTS.UPDATE_PREFERENCES,
        preferences
      );
      return response;
    } catch (error) {
      throw new Error('Failed to update user preferences');
    }
  }

  /**
   * Updates user password with validation
   * @param currentPassword - Current password for verification
   * @param newPassword - New password to set
   * @returns Promise resolving to success status
   */
  public static async updatePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    try {
      await apiClient.put(USER_ENDPOINTS.UPDATE_PASSWORD, {
        currentPassword,
        newPassword
      });
      return true;
    } catch (error) {
      throw new Error('Failed to update password');
    }
  }

  /**
   * Searches users by name or email
   * @param searchTerm - Search query string
   * @returns Promise resolving to filtered user list
   */
  private static async searchUsers(searchTerm: string): Promise<IUser[]> {
    try {
      const response = await apiClient.get<IUser[]>(
        `${USER_ENDPOINTS.GET_ALL}?search=${encodeURIComponent(searchTerm)}`
      );
      return response;
    } catch (error) {
      throw new Error('Failed to search users');
    }
  }

  /**
   * Gets user preferences with caching
   * @returns Promise resolving to user preferences
   */
  public static async getUserPreferences(): Promise<IUserPreferences> {
    try {
      const response = await apiClient.get<IUserPreferences>(
        USER_ENDPOINTS.GET_PREFERENCES
      );
      return response;
    } catch (error) {
      throw new Error('Failed to fetch user preferences');
    }
  }
}

// Export type definitions for external use
export type { UserFilters, PaginationParams, PaginatedResponse };