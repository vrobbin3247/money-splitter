import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import Modal from "../ui/Modal";
import {
  ModalHeader,
  AmountHero,
  QuickStats,
  PaymentInfo,
  SplitBreakdown,
  SettlementSummary,
  ActionButtons,
  SettlementFeedbackToast,
  //   LoadingState,
} from "./ExpenseModalComponenets";

// interface Expense {
//   id: string;
//   title: string;
//   amount: number;
//   buyer_id: string;
//   created_at: string;
//   total_participants?: number;
//   buyer_name?: string;
//   participants?: Participant[];
//   [key: string]: any;
// }

interface Settlement {
  id: string;
  expense_id: string;
  payer_id: string;
  payee_id: string;
  amount: number;
  is_settled: boolean;
}

interface Participant {
  id?: string;
  participant_id: string;
  name: string;
  settlement_status?: boolean;
}

interface ExpenseDetails {
  id: string;
  title: string;
  amount: number;
  buyer_id: string;
  buyer_name: string;
  participants: Participant[];
  total_participants: number;
  created_at: string;
}

interface SettlementFeedback {
  show: boolean;
  type: "success" | "error";
  message: string;
  participantName?: string;
}

interface ExpenseModalProps {
  selectedExpenseId: string | null;
  onClose: () => void;
  onExpenseUpdate?: () => void; // Optional callback to refresh parent data
}

export default function ExpenseModal({
  selectedExpenseId,
  onClose,
  onExpenseUpdate,
}: ExpenseModalProps) {
  const [selectedExpenseDetails, setSelectedExpenseDetails] =
    useState<ExpenseDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [settlementFeedback, setSettlementFeedback] =
    useState<SettlementFeedback>({
      show: false,
      type: "success",
      message: "",
    });
  const [settlingParticipants, setSettlingParticipants] = useState<Set<string>>(
    new Set()
  );
  const { user } = useAuth();

  const calculateSplitAmount = (amount: number, totalParticipants: number) => {
    return Number(amount / totalParticipants);
  };

  const markAsSettled = async (participantId: string, expenseId: string) => {
    if (!user || !selectedExpenseDetails) return;

    setSettlingParticipants((prev) => new Set([...prev, participantId]));

    try {
      // Verify the expense exists and get buyer info
      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .select("buyer_id")
        .eq("id", expenseId)
        .single();

      if (expenseError) throw expenseError;

      // Check if user is participant in this expense
      const { data: participantCheck } = await supabase
        .from("expense_participants")
        .select("participant_id")
        .eq("expense_id", expenseId)
        .eq("participant_id", user.id)
        .single();

      // User must be either buyer or participant
      const isBuyer = expense.buyer_id === user.id;
      const isParticipant = !!participantCheck;

      if (!isBuyer && !isParticipant) {
        throw new Error("You are not authorized to settle this expense");
      }

      if (!isBuyer && participantId !== user.id) {
        throw new Error("You can only settle your own share");
      }

      // Update participant status
      const { error: updateError } = await supabase
        .from("expense_participants")
        .update({ settlement_status: true })
        .eq("expense_id", expenseId)
        .eq("participant_id", participantId);

      if (updateError) throw updateError;

      // Create settlement record
      const { data: settlement, error: settlementError } = await supabase
        .from("settlements")
        .insert([
          {
            expense_id: expenseId,
            payer_id: participantId,
            payee_id: expense.buyer_id,
            amount: calculateSplitAmount(
              selectedExpenseDetails.amount,
              selectedExpenseDetails.total_participants
            ),
            is_settled: true,
            settlement_type: "individual",
          },
        ])
        .select();

      if (settlementError) throw settlementError;

      // Update local state
      if (settlement) {
        setSettlements([...settlements, ...settlement]);
        setSelectedExpenseDetails({
          ...selectedExpenseDetails,
          participants: selectedExpenseDetails.participants.map((p) =>
            p.participant_id === participantId
              ? { ...p, settlement_status: true }
              : p
          ),
        });

        const participantName =
          selectedExpenseDetails.participants.find(
            (p) => p.participant_id === participantId
          )?.name || "Participant";

        setSettlementFeedback({
          show: true,
          type: "success",
          message: `${participantName}'s payment has been marked as settled!`,
          participantName,
        });

        // Call parent callback to refresh data
        if (onExpenseUpdate) {
          onExpenseUpdate();
        }

        setTimeout(() => {
          setSettlementFeedback((prev) => ({ ...prev, show: false }));
        }, 3000);
      }
    } catch (error: any) {
      console.error("Settlement error:", error);
      setSettlementFeedback({
        show: true,
        type: "error",
        message: error.message || "Failed to settle payment. Please try again.",
      });
      setTimeout(() => {
        setSettlementFeedback((prev) => ({ ...prev, show: false }));
      }, 4000);
    } finally {
      setSettlingParticipants((prev) => {
        const newSet = new Set(prev);
        newSet.delete(participantId);
        return newSet;
      });
    }
  };

  useEffect(() => {
    async function fetchExpenseDetails() {
      if (!selectedExpenseId) {
        setSelectedExpenseDetails(null);
        return;
      }

      setDetailsLoading(true);
      try {
        // Fetch the basic expense data
        const { data: expenseData, error: expenseError } = await supabase
          .from("expenses")
          .select("*")
          .eq("id", selectedExpenseId)
          .single();

        if (expenseError) throw expenseError;

        // Fetch buyer's name
        let buyerName: string = "Unknown";
        if (expenseData?.buyer_id) {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("name")
            .eq("id", expenseData.buyer_id)
            .single();

          if (profileError) {
            console.error("Error fetching buyer profile:", profileError);
          } else {
            buyerName = profileData?.name || "Unknown";
          }
        }

        // Fetch participants with their names
        const { data: participantsData, error: participantsError } =
          await supabase
            .from("expense_participants")
            .select(
              `
            participant_id,
            settlement_status,
            profiles!inner(name)
          `
            )
            .eq("expense_id", selectedExpenseId);

        if (participantsError) throw participantsError;

        // Fetch settlement records for this expense
        const { data: settlementsData, error: settlementsError } =
          await supabase
            .from("settlements")
            .select("*")
            .eq("expense_id", selectedExpenseId);

        if (settlementsError)
          console.error("Error fetching settlements:", settlementsError);

        setSettlements(settlementsData || []);

        // Process participants with settlement status
        const participantsWithStatus: Participant[] =
          participantsData?.map((p: any) => {
            const isSettled =
              settlementsData?.some(
                (s: Settlement) =>
                  s.payer_id === p.participant_id && s.is_settled
              ) || p.settlement_status;

            return {
              participant_id: p.participant_id,
              name: p.profiles?.name || "Unknown",
              settlement_status: isSettled,
            };
          }) || [];

        // Calculate unique participants count
        const participantNames = participantsWithStatus.map((p) => p.name);
        const uniqueParticipants = new Set([buyerName, ...participantNames]);
        const totalParticipants = uniqueParticipants.size;

        // Update state with all the fetched data
        setSelectedExpenseDetails({
          ...expenseData,
          buyer_name: buyerName,
          participants: participantsWithStatus,
          total_participants: totalParticipants,
        });
      } catch (error: any) {
        console.error("Error fetching expense details:", error);
      } finally {
        setDetailsLoading(false);
      }
    }

    fetchExpenseDetails();
  }, [selectedExpenseId]);

  return (
    <Modal isOpen={!!selectedExpenseId} onClose={onClose}>
      {selectedExpenseDetails && !detailsLoading ? (
        <div className="max-h-[90vh] overflow-hidden flex flex-col">
          <ModalHeader expense={selectedExpenseDetails} onClose={onClose} />

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              <AmountHero expense={selectedExpenseDetails} />

              <QuickStats expense={selectedExpenseDetails} />

              <SettlementSummary expense={selectedExpenseDetails} />

              <PaymentInfo expense={selectedExpenseDetails} />

              <SplitBreakdown
                expense={selectedExpenseDetails}
                onMarkAsSettled={markAsSettled}
                settlementFeedback={settlementFeedback}
                settlingParticipants={settlingParticipants}
              />
            </div>
          </div>

          <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 px-6 py-4">
            <ActionButtons onClose={onClose} />
          </div>

          <SettlementFeedbackToast settlementFeedback={settlementFeedback} />
        </div>
      ) : (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4">
              <div className="w-full h-full border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <p className="text-gray-600 font-medium">
              Loading expense details...
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
