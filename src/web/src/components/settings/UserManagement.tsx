import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { 
  Box, 
  Button, 
  IconButton, 
  Menu, 
  MenuItem, 
  Typography,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Security as SecurityIcon,
  Block as BlockIcon
} from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from '../common/DataGrid';
import ErrorBoundary from '../common/ErrorBoundary';
import { COLORS, TYPOGRAPHY } from '../../constants/theme';

// Enums and Types
enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  BLOCKED = 'BLOCKED'
}

enum ROLES {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  AGENT = 'AGENT',
  VIEWER = 'VIEWER'
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: ROLES;
  status: UserStatus;
  lastLogin: string;
  createdAt: string;
}

interface UserManagementProps {
  tenantId: string;
  userRole: ROLES;
}

interface UserFilters {
  role: ROLES | null;
  status: UserStatus | null;
  search: string;
  dateRange: DateRange | null;
}

interface DateRange {
  start: Date;
  end: Date;
}

// Constants
const PAGE_SIZE = 25;
const DEBOUNCE_DELAY = 300;

/**
 * UserManagement Component
 * 
 * Provides comprehensive user management functionality for tenant administrators
 * with role-based access control and tenant isolation.
 */
const UserManagement: React.FC<UserManagementProps> = React.memo(({ tenantId, userRole }) => {
  // State Management
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [totalRows, setTotalRows] = useState(0);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filters, setFilters] = useState<UserFilters>({
    role: null,
    status: null,
    search: '',
    dateRange: null
  });

  // Memoized Columns Definition
  const columns = useMemo<GridColDef[]>(() => [
    {
      field: 'email',
      headerName: 'Email',
      flex: 1,
      renderCell: (params) => (
        <Tooltip title={params.value}>
          <Typography variant="body2" noWrap>
            {params.value}
          </Typography>
        </Tooltip>
      )
    },
    {
      field: 'firstName',
      headerName: 'First Name',
      flex: 1
    },
    {
      field: 'lastName',
      headerName: 'Last Name',
      flex: 1
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 120,
      renderCell: (params) => (
        <Box sx={{ 
          backgroundColor: COLORS.background.secondary,
          padding: '4px 8px',
          borderRadius: '4px'
        }}>
          <Typography variant="body2">
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Box sx={{ 
          backgroundColor: getStatusColor(params.value),
          padding: '4px 8px',
          borderRadius: '4px'
        }}>
          <Typography variant="body2" color="white">
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'lastLogin',
      headerName: 'Last Login',
      width: 180,
      valueFormatter: (params) => new Date(params.value).toLocaleString()
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          onClick={(event) => handleActionClick(event, params.row)}
          disabled={!canManageUser(params.row.role)}
        >
          <MoreVertIcon />
        </IconButton>
      )
    }
  ], [userRole]);

  // Handlers
  const handlePageChange = useCallback(async (newPage: number) => {
    try {
      setLoading(true);
      setPage(newPage);
      // API call with tenant context
      const response = await fetch(`/api/users?tenant=${tenantId}&page=${newPage}&size=${PAGE_SIZE}`, {
        headers: {
          'X-Tenant-ID': tenantId
        }
      });
      const data = await response.json();
      setUsers(data.users);
      setTotalRows(data.total);
    } catch (err) {
      setError('Failed to fetch users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const handleActionClick = useCallback((event: React.MouseEvent<HTMLElement>, user: User) => {
    event.stopPropagation();
    setSelectedUser(user);
    setActionMenuAnchor(event.currentTarget);
  }, []);

  const handleRoleChange = useCallback(async (userId: string, newRole: ROLES) => {
    if (!canManageUser(newRole)) {
      return;
    }

    try {
      setLoading(true);
      // API call with tenant context and audit logging
      await fetch(`/api/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': tenantId
        },
        body: JSON.stringify({ role: newRole })
      });

      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
    } catch (err) {
      setError('Failed to update user role');
      console.error('Error updating role:', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Helper Functions
  const canManageUser = useCallback((targetRole: ROLES): boolean => {
    const roleHierarchy = {
      [ROLES.ADMIN]: 4,
      [ROLES.MANAGER]: 3,
      [ROLES.AGENT]: 2,
      [ROLES.VIEWER]: 1
    };

    return roleHierarchy[userRole] > roleHierarchy[targetRole];
  }, [userRole]);

  const getStatusColor = (status: UserStatus): string => {
    const statusColors = {
      [UserStatus.ACTIVE]: COLORS.secondary,
      [UserStatus.INACTIVE]: COLORS.warning,
      [UserStatus.BLOCKED]: COLORS.error
    };
    return statusColors[status];
  };

  // Effects
  useEffect(() => {
    handlePageChange(0);
  }, [tenantId]);

  return (
    <ErrorBoundary tenantId={tenantId}>
      <Box sx={{ height: '100%', width: '100%' }}>
        <Typography variant="h5" sx={{ mb: 3 }}>
          User Management
        </Typography>

        <CustomDataGrid
          rows={users}
          columns={columns}
          loading={loading}
          error={error}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
          totalRows={totalRows}
          autoHeight
        />

        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={() => setActionMenuAnchor(null)}
        >
          <MenuItem onClick={() => setEditDialogOpen(true)}>
            <EditIcon sx={{ mr: 1 }} /> Edit User
          </MenuItem>
          <MenuItem onClick={() => handleRoleChange(selectedUser?.id || '', ROLES.BLOCKED)}>
            <BlockIcon sx={{ mr: 1 }} /> Block User
          </MenuItem>
        </Menu>

        {/* Edit User Dialog */}
        <Dialog 
          open={editDialogOpen} 
          onClose={() => setEditDialogOpen(false)}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>Edit User</DialogTitle>
          <DialogContent>
            {selectedUser && (
              <Box sx={{ mt: 2 }}>
                <TextField
                  label="Email"
                  value={selectedUser.email}
                  fullWidth
                  disabled
                  sx={{ mb: 2 }}
                />
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={selectedUser.role}
                    onChange={(e) => handleRoleChange(selectedUser.id, e.target.value as ROLES)}
                    disabled={!canManageUser(selectedUser.role)}
                  >
                    {Object.values(ROLES).map((role) => (
                      <MenuItem key={role} value={role}>
                        {role}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" color="primary">Save</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ErrorBoundary>
  );
});

UserManagement.displayName = 'UserManagement';

export default UserManagement;