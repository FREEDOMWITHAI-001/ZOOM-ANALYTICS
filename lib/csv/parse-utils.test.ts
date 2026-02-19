import { expect } from 'chai';
import 'mocha';
import { parseAttendanceCSV } from './parse-utils';

// Sample test for parseAttendanceCSV
describe('parseAttendanceCSV', () => {
  it('should parse valid CSV content', () => {
    const csvContent = `Name,Join Time,Leave Time\nJohn Doe,1/4/25 19:31,1/4/25 20:31`;
    const result = parseAttendanceCSV(csvContent);
    expect(result).to.have.length(1);
    expect(result[0]).to.include({
      name: 'John Doe',
      joinTime: new Date(2025, 0, 4, 19, 31),
      leaveTime: new Date(2025, 0, 4, 20, 31)
    });
  });

  it('should handle missing join or leave time columns', () => {
    const csvContent = `Name,Join Time\nJohn Doe,1/4/25 19:31`;
    expect(() => parseAttendanceCSV(csvContent)).to.throw();
  });

  it('should skip rows with invalid timestamps', () => {
    const csvContent = `Name,Join Time,Leave Time\nJohn Doe,invalid,1/4/25 20:31`;
    const result = parseAttendanceCSV(csvContent);
    expect(result).to.have.length(0);
  });
});
