import React, { useState, useMemo, useCallback } from 'react';
import { 
  FormControl, 
  Select, 
  MenuItem, 
  CircularProgress,
  Typography,
  Box,
  Tooltip
} from '@mui/material'; // ^5.0.0
import { Lead } from '../../types/lead';
import { User } from '../../types/user';
import { useLeads } from '../../hooks/useLeads';
import { ROLES } from '../../../backend/src/constants/roles';

/**
 * Props interface for LeadAssignment component
 */
interface LeadAssignmentProps {
  /** Lead to be assigned */
  lead: Lead;
  /** List of available agents */
  agents: User[];
  /** Callback for assignment changes */
  onAssignmentChange: (updatedLead: Lead) => void;
  /** Current tenant ID for isolation */
  tenantId: string;
  /** Maximum leads per agent limit */
  maxLeadsPerAgent: number;
}

/**
 * LeadAssignment component for managing lead assignments to agents
 * Implements role-based access control and workload validation
 */
const LeadAssignment: React.FC<LeadAssignmentProps> = ({
  lead,
  agents,
  onAssignmentChange,
  tenantId,
  maxLeadsPerAgent
}) => {
  // Local state management
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimisticAssignment, setOptimisticAssignment] = useState<string | null>(null);

  // Custom hook for lead operations
  const { updateLead } = useLeads(tenantId);

  // Filter agents by tenant and role
  const filteredAgents = useMemo(() => {
    return agents.filter(agent => (
      agent.tenantId === tenantId &&
      (agent.role === ROLES.AGENT || agent.role === ROLES.MANAGER) &&
      (agent.id === lead.assignedTo || agent.leadCount < maxLeadsPerAgent)
    ));
  }, [agents, tenantId, lead.assignedTo, maxLeadsPerAgent]);

  /**
   * Handles the assignment change with validation and optimistic updates
   */
  const handleAssignmentChange = useCallback(async (
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    const newAgentId = event.target.value as string;
    setError(null);

    try {
      // Validate agent belongs to same tenant
      const selectedAgent = agents.find(agent => agent.id === newAgentId);
      if (!selectedAgent || selectedAgent.tenantId !== tenantId) {
        throw new Error('Invalid agent selection');
      }

      // Check agent workload
      if (
        selectedAgent.leadCount >= maxLeadsPerAgent && 
        lead.assignedTo !== newAgentId
      ) {
        throw new Error(`Agent has reached maximum lead capacity of ${maxLeadsPerAgent}`);
      }

      setLoading(true);
      setOptimisticAssignment(newAgentId);

      // Update lead assignment
      const updatedLead = await updateLead(lead.id, {
        assignedTo: newAgentId,
        tenantId
      });

      // Trigger callback with updated lead
      onAssignmentChange(updatedLead);
      setOptimisticAssignment(null);

    } catch (error) {
      // Revert optimistic update
      setOptimisticAssignment(null);
      setError(error instanceof Error ? error.message : 'Failed to assign lead');
    } finally {
      setLoading(false);
    }
  }, [agents, lead, tenantId, maxLeadsPerAgent, updateLead, onAssignmentChange]);

  return (
    <Box sx={{ position: 'relative', minWidth: 200 }}>
      <FormControl 
        fullWidth 
        error={!!error}
        disabled={loading}
      >
        <Select
          value={optimisticAssignment || lead.assignedTo || ''}
          onChange={handleAssignmentChange}
          displayEmpty
          variant="outlined"
          size="small"
        >
          <MenuItem value="">
            <em>Unassigned</em>
          </MenuItem>
          {filteredAgents.map(agent => (
            <Tooltip
              key={agent.id}
              title={`Current leads: ${agent.leadCount}/${maxLeadsPerAgent}`}
              placement="right"
            >
              <MenuItem 
                value={agent.id}
                disabled={
                  agent.leadCount >= maxLeadsPerAgent && 
                  lead.assignedTo !== agent.id
                }
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Typography>
                    {`${agent.firstName} ${agent.lastName}`}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {`${agent.leadCount}/${maxLeadsPerAgent}`}
                  </Typography>
                </Box>
              </MenuItem>
            </Tooltip>
          ))}
        </Select>
        {error && (
          <Typography 
            variant="caption" 
            color="error" 
            sx={{ mt: 0.5 }}
          >
            {error}
          </Typography>
        )}
      </FormControl>
      {loading && (
        <CircularProgress
          size={20}
          sx={{
            position: 'absolute',
            right: -28,
            top: '50%',
            marginTop: '-10px'
          }}
        />
      )}
    </Box>
  );
};

export default React.memo(LeadAssignment);