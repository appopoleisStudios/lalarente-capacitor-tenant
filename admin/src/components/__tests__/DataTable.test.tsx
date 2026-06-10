import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DataTable from '../DataTable';
import type { Column } from '../DataTable';

interface TestItem {
  id: string;
  name: string;
  value: number;
}

const columns: Column<TestItem>[] = [
  { key: 'name', label: 'Name', render: (item) => <span>{item.name}</span> },
  { key: 'value', label: 'Value', render: (item) => <span>{item.value}</span> },
];

const testData: TestItem[] = [
  { id: '1', name: 'Alpha', value: 100 },
  { id: '2', name: 'Beta', value: 200 },
];

describe('DataTable', () => {
  it('renders column headers', () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        keyExtractor={(item) => item.id}
      />
    );
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders data rows', () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        keyExtractor={(item) => item.id}
      />
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Beta')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('200')).toBeInTheDocument();
  });

  it('shows loading spinner when loading is true', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        keyExtractor={(item) => item.id}
        loading={true}
      />
    );
    // The loading spinner has an animate-spin class
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('shows empty message when data is empty and not loading', () => {
    render(
      <DataTable
        columns={columns}
        data={[]}
        keyExtractor={(item) => item.id}
        emptyMessage="Nothing here"
      />
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders summary row when summary is provided', () => {
    render(
      <DataTable
        columns={columns}
        data={testData}
        keyExtractor={(item) => item.id}
        summary={[{ label: 'Total', value: '2 items' }]}
      />
    );
    expect(screen.getByText('Total: 2 items')).toBeInTheDocument();
  });
});
