import { format, addMonths, subMonths, isAfter, startOfMonth, isBefore, addDays, startOfDay, differenceInMonths, parseISO } from 'date-fns';
import { Member, Payment } from '../types';

export const calculateProRataRent = (rentAmount: number, joiningDate: string) => {
  const date = parseISO(joiningDate);
  const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const remainingDays = daysInMonth - date.getDate() + 1;
  return Math.round((rentAmount / daysInMonth) * remainingDays);
};

export const getDuesInfo = (member: Member, payments: Payment[] = []) => {
  const today = startOfDay(new Date());
  // Safety check for joiningDate
  let joiningDate: Date;
  try {
    if (!member.joiningDate) {
      joiningDate = startOfDay(new Date());
    } else {
      const parsed = parseISO(member.joiningDate);
      joiningDate = isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
    }
  } catch (e) {
    joiningDate = startOfDay(new Date());
  }
  const billingType = member.billingType || 'anniversary';
  const billingDay = billingType === 'fixed_first' ? 1 : joiningDate.getDate();

  let checkDate = joiningDate;
  let targetMonth = format(checkDate, 'yyyy-MM');
  let expectedAmount = 0;
  let totalPaid = 0;
  let isFullyPaid = false;

  const maxIterations = 48; // 4 years
  for (let i = 0; i < maxIterations; i++) {
    targetMonth = format(checkDate, 'yyyy-MM');
    expectedAmount = member.rentAmount;
    
    // First month logic: add deposit and handle pro-rata if fixed_first
    if (targetMonth === format(joiningDate, 'yyyy-MM')) {
      expectedAmount += member.deposit;
      if (billingType === 'fixed_first') {
        expectedAmount = calculateProRataRent(member.rentAmount, member.joiningDate) + member.deposit;
      }
    }

    const monthPayments = payments.filter(p => p.memberId === member.id && p.month === targetMonth);
    totalPaid = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    isFullyPaid = totalPaid >= expectedAmount;

    // If this month is NOT fully paid, this is our target due month
    if (!isFullyPaid) {
      break;
    }

    // If it IS fully paid, move to the next month
    let nextDate = startOfMonth(addMonths(checkDate, 1));
    nextDate.setDate(billingDay);
    
    // Safety check: if we've moved past today and everything is paid, 
    // we still want to show the NEXT month's due date.
    checkDate = nextDate;
    
    // If we are already far in the future and everything is paid, we can stop.
    if (isAfter(checkDate, addMonths(today, 2))) {
      break;
    }
  }

  // Now checkDate, targetMonth, expectedAmount, totalPaid are for the first UNPAID month
  const isOverdue = isBefore(checkDate, today);
  const isDueToday = format(today, 'yyyy-MM-dd') === format(checkDate, 'yyyy-MM-dd');
  const isDueSoon = !isOverdue && !isDueToday && isBefore(checkDate, addDays(today, 8));

  return {
    isPaid: !isOverdue && !isDueToday && !isDueSoon,
    isOverdue,
    isDueSoon,
    isDueToday,
    dueDate: checkDate,
    targetMonth,
    expected: expectedAmount,
    remaining: expectedAmount - totalPaid,
    billingDay
  };
};
