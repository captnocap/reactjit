import React from 'react';
import { Box, Text, Table, Badge } from '../../../../packages/shared/src';
import type { TableColumn } from '../../../../packages/shared/src';

interface Employee {
  name: string;
  role: string;
  status: string;
  score: number;
  team: string;
}

const EMPLOYEES: Employee[] = [
  { name: 'Alice Chen', role: 'Engineer', status: 'active', score: 94, team: 'Platform' },
  { name: 'Bob Park', role: 'Designer', status: 'active', score: 87, team: 'Product' },
  { name: 'Carol Wu', role: 'PM', status: 'away', score: 76, team: 'Growth' },
  { name: 'Dan Kim', role: 'Engineer', status: 'active', score: 91, team: 'Platform' },
  { name: 'Eva Lopez', role: 'Data Sci', status: 'offline', score: 82, team: 'ML' },
  { name: 'Frank Lee', role: 'Engineer', status: 'active', score: 88, team: 'Infra' },
];

const BASIC_COLUMNS: TableColumn<Employee>[] = [
  { key: 'name', title: 'Name', width: 100 },
  { key: 'role', title: 'Role', width: 80 },
  { key: 'status', title: 'Status', width: 70 },
  { key: 'score', title: 'Score', width: 50, align: 'right' },
  { key: 'team', title: 'Team', width: 80 },
];

const statusVariant = (s: string) => {
  if (s === 'active') return 'success' as const;
  if (s === 'away') return 'warning' as const;
  return 'error' as const;
};

const scoreColor = (s: number) => {
  if (s >= 90) return '#22c55e';
  if (s >= 80) return '#3b82f6';
  if (s >= 70) return '#f59e0b';
  return '#ef4444';
};

const CUSTOM_COLUMNS: TableColumn<Employee>[] = [
  { key: 'name', title: 'Name', width: 100 },
  { key: 'role', title: 'Role', width: 80 },
  {
    key: 'status',
    title: 'Status',
    width: 80,
    render: (value: string) => (
      <Badge label={value} variant={statusVariant(value)} />
    ),
  },
  {
    key: 'score',
    title: 'Score',
    width: 50,
    align: 'right',
    render: (value: number) => (
      <Text style={{ color: scoreColor(value), fontSize: 11, fontWeight: 'bold' }}>{value}</Text>
    ),
  },
  { key: 'team', title: 'Team', width: 80 },
];

export function TableStory() {
  return (
    <Box style={{ gap: 20, padding: 16 }}>

      {/* Basic Table */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Basic Table</Text>
        <Table columns={BASIC_COLUMNS} data={EMPLOYEES} rowKey="name" />
      </Box>

      {/* Striped Rows */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Striped Rows</Text>
        <Table columns={BASIC_COLUMNS} data={EMPLOYEES} rowKey="name" striped />
      </Box>

      {/* Custom Cell Rendering */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Custom Cell Rendering</Text>
        <Table columns={CUSTOM_COLUMNS} data={EMPLOYEES} rowKey="name" />
      </Box>

      {/* Narrow Table (truncation) */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Narrow Table</Text>
        <Table
          columns={[
            { key: 'name', title: 'Name', width: 70 },
            { key: 'role', title: 'Role', width: 60 },
            { key: 'score', title: 'Score', width: 40, align: 'right' },
          ]}
          data={EMPLOYEES}
          rowKey="name"
          style={{ width: 190 }}
        />
      </Box>

      {/* Borderless */}
      <Box style={{ gap: 6 }}>
        <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: 'bold' }}>Borderless</Text>
        <Table columns={BASIC_COLUMNS} data={EMPLOYEES.slice(0, 3)} rowKey="name" borderless striped />
      </Box>

    </Box>
  );
}
