import React from "react";
import { FiCalendar, FiUsers } from "react-icons/fi";
import { categories } from "../../components/constants/categories";

interface Expense {
  id: string;
  title: string;
  amount: number;
  buyer_id: string;
  created_at: string;
  category: string;
  total_participants?: number;
  buyer_name?: string;
  participants?: Participant[];
}

interface Participant {
  id?: string;
  participant_id: string;
  name: string;
  settlement_status?: boolean;
}

interface ExpenseCardProps {
  expense: Expense;
  userId?: string;
  selectedExpenseId: string | null;
  onExpenseClick: (expenseId: string) => void;
}

const ExpenseCard: React.FC<ExpenseCardProps> = ({
  expense,
  userId,
  selectedExpenseId,
  onExpenseClick,
}) => {
  const calculateSplitAmount = (amount: number, totalParticipants: number) => {
    return Number(amount / totalParticipants);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
      });
    }
  };

  const getCategoryIcon = (categoryValue: string) => {
    const found = categories.find((cat) => cat.value === categoryValue);
    return found?.icon || null;
  };

  const getSettlementStatus = (expense: Expense, userId?: string) => {
    if (!expense.total_participants || expense.total_participants <= 1) {
      return {
        isFullySettled: true,
        settledCount: 0,
        totalCount: 0,
        progress: 100,
        userPerspective: "complete",
      };
    }

    const isUserBuyer = expense.buyer_id === userId;
    const totalCount = expense.total_participants;
    const settledCount = expense.participants
      ? expense.participants.filter((p: Participant) => p.settlement_status)
          .length
      : 0;

    if (isUserBuyer) {
      const isFullySettled = settledCount === totalCount;
      const progress = (settledCount / totalCount) * 100;
      return {
        isFullySettled,
        settledCount,
        totalCount,
        progress,
        userPerspective: "buyer",
        displayText: `${settledCount}/${totalCount} paid`,
      };
    } else {
      const userParticipant = expense.participants?.find(
        (p: Participant) => p.participant_id === userId
      );
      const isUserSettled = userParticipant?.settlement_status || false;
      return {
        isFullySettled: isUserSettled,
        settledCount: isUserSettled ? 1 : 0,
        totalCount: 1,
        progress: isUserSettled ? 100 : 0,
        userPerspective: "participant",
        displayText: isUserSettled ? "Paid" : "Pending",
      };
    }
  };

  const isUserBuyer = expense.buyer_id === userId;
  const settlement = getSettlementStatus(expense, userId);
  const splitAmount = expense.total_participants
    ? calculateSplitAmount(expense.amount, expense.total_participants)
    : 0;

  return (
    <div
      className={`relative shadow-sm bg-white rounded-2xl py-2.5 p-4 border active:scale-[0.98] transition-all cursor-pointer group
        ${
          settlement.isFullySettled
            ? "border-l border-t border-r-4 border-r-green-400 border-b border-gray-100"
            : "border border-gray-100 hover:border-gray-300"
        }
        ${
          selectedExpenseId === expense.id
            ? "ring-1 ring-blue-400 border-blue-200"
            : "border-gray-100 hover:border-gray-300"
        }
        ${settlement.isFullySettled ? "opacity-90" : ""}`}
      onClick={() => onExpenseClick(expense.id)}
    >
      <div className="flex items-start justify-between">
        {/* Left content */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Category icon */}
          <div
            className={`p-2 rounded-lg mt-1 ${
              settlement.isFullySettled
                ? "bg-green-50 text-green-600"
                : "bg-gray-50 text-gray-600"
            }`}
          >
            {getCategoryIcon(expense.category)}
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <h3 className="text-base font-medium text-gray-900 truncate">
                {expense.title}
              </h3>

              {/* Status dot */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  settlement.isFullySettled
                    ? "bg-green-500"
                    : isUserBuyer
                    ? "bg-blue-500"
                    : "bg-amber-400"
                }`}
              />
            </div>

            {/* Metadata row */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <FiCalendar className="w-3 h-3 opacity-70" />
                <span>{formatDate(expense.created_at)}</span>
              </div>

              {(expense.total_participants ?? 0) > 1 && (
                <div className="flex items-center gap-1">
                  <FiUsers className="w-3 h-3 opacity-70" />
                  <span>{expense.total_participants}</span>
                </div>
              )}

              {/* Settlement status text */}
              {!settlement.isFullySettled && (
                <div
                  className={`text-xs ${
                    isUserBuyer ? "text-blue-600" : "text-amber-600"
                  }`}
                >
                  {isUserBuyer
                    ? `${settlement.settledCount}/${settlement.totalCount} settled`
                    : "Pending"}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right amount */}
        <div className="text-right pl-2">
          <div
            className={`text-lg font-medium ${
              isUserBuyer ? "text-gray-900" : "text-gray-700"
            }`}
          >
            ₹
            {isUserBuyer
              ? expense.amount.toLocaleString()
              : splitAmount.toLocaleString()}
          </div>

          {!isUserBuyer && (expense.total_participants ?? 0) > 1 && (
            <div className="text-xs text-gray-400 mt-0.5">
              of ₹{expense.amount.toLocaleString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExpenseCard;
