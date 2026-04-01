import { describe, it, expect } from 'vitest';
import { calculateProRataRent, getDuesInfo } from './dues';
import { Member, Payment } from '../types';

describe('dues utilities', () => {
  describe('calculateProRataRent', () => {
    it('calculates rent correctly for middle of the month', () => {
      // 30 days in April 2024. Joining on 16th means 15 days remaining (16 to 30 inclusive)
      // Wait, 30 - 16 + 1 = 15. Correct.
      const rent = 3000;
      const joiningDate = '2024-04-16';
      const expected = Math.round((3000 / 30) * 15); // 1500
      expect(calculateProRataRent(rent, joiningDate)).toBe(expected);
    });

    it('calculates rent correctly for first of the month', () => {
      const rent = 3000;
      const joiningDate = '2024-04-01';
      const expected = 3000;
      expect(calculateProRataRent(rent, joiningDate)).toBe(expected);
    });
  });

  describe('getDuesInfo', () => {
    const mockMember: Member = {
      id: '1',
      name: 'John Doe',
      phone: '1234567890',
      hostelId: 'h1',
      roomId: 'r1',
      bedId: 'b1',
      idProof: 'proof1',
      rentAmount: 5000,
      deposit: 2000,
      joiningDate: '2024-01-01',
      status: 'active',
      billingType: 'anniversary',
      organizationId: 'org1'
    };

    it('identifies overdue payments correctly', () => {
      // No payments made, should be overdue since joining date is in the past
      const info = getDuesInfo(mockMember, []);
      expect(info.isOverdue).toBe(true);
      expect(info.targetMonth).toBe('2024-01');
      expect(info.expected).toBe(7000); // Rent + Deposit
    });

    it('identifies paid status correctly', () => {
      const payments: Payment[] = [
        {
          id: 'p1',
          memberId: '1',
          amount: 7000,
          month: '2024-01',
          date: '2024-01-01',
          method: 'cash',
          status: 'paid',
          hostelId: 'h1',
          organizationId: 'org1'
        }
      ];
      
      // If we are in Jan 2024, it should be paid.
      // But getDuesInfo uses 'today'. We need to be careful with tests that depend on current date.
      // For now, let's just check if it moves to the next month.
      const info = getDuesInfo(mockMember, payments);
      expect(info.targetMonth).toBe('2024-02');
      expect(info.expected).toBe(5000); // Just rent
    });
  });
});
