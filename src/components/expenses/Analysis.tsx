import { useState, useEffect } from "react";
import {
  FiTrendingUp,
  FiBarChart,
  FiPieChart,
  FiUsers,
  FiActivity,
  FiAlertCircle,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { supabase } from "../../lib/supabase";
import Modal from "../ui/Modal";

interface AnalysisProps {
  user: { id: string };
}

// interface ExpenseData {
//   id: string;
//   amount: number;
//   title: string;
//   category: string;
//   created_at: string;
//   buyer_id: string;
//   profiles: { name: string };
// }

interface AnalysisData {
  totalExpenses: number;
  monthlySpending: Array<{ month: string; amount: number }>;
  categoryBreakdown: Array<{ category: string; amount: number; color: string }>;
  topPartners: Array<{ name: string; count: number; amount: number }>;
  avgExpenseAmount: number;
  expenseCount: number;
  settlementRatio: number;
  insights: Array<{ type: "positive" | "warning" | "info"; message: string }>;
}

const Analysis = ({ user }: AnalysisProps) => {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChart, setSelectedChart] = useState<
    "monthly" | "category" | "partners" | null
  >(null);

  const categoryColors = {
    food: "#ef4444",
    utilities: "#3b82f6",
    entertainment: "#8b5cf6",
    transport: "#f59e0b",
    shopping: "#ec4899",
    healthcare: "#10b981",
    other: "#6b7280",
  };

  useEffect(() => {
    async function fetchAnalysisData() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Get all expenses where user was buyer or participant
        const { data: buyerExpenses, error: buyerError } = await supabase
          .from("expenses")
          .select(
            `
            *,
            profiles!expenses_buyer_id_fkey(name)
          `
          )
          .eq("buyer_id", user.id)
          .order("created_at", { ascending: false });

        if (buyerError) throw buyerError;

        const { data: participantExpenses, error: participantError } =
          await supabase
            .from("expense_participants")
            .select(
              `
            expenses!inner(
              *,
              profiles!expenses_buyer_id_fkey(name)
            )
          `
            )
            .eq("participant_id", user.id)
            .order("created_at", { ascending: false });

        if (participantError) throw participantError;

        // Combine and deduplicate expenses
        const participantExpenseList =
          participantExpenses?.map((p: any) => p.expenses) || [];
        const combined = [...(buyerExpenses || []), ...participantExpenseList];
        const uniqueExpenses = Object.values(
          combined.reduce((acc: any, exp: any) => {
            acc[exp.id] = exp;
            return acc;
          }, {})
        );

        if (uniqueExpenses.length === 0) {
          setAnalysisData({
            totalExpenses: 0,
            monthlySpending: [],
            categoryBreakdown: [],
            topPartners: [],
            avgExpenseAmount: 0,
            expenseCount: 0,
            settlementRatio: 0,
            insights: [
              {
                type: "info",
                message:
                  "No expenses found. Start adding expenses to see insights!",
              },
            ],
          });
          return;
        }

        // Get all participants for partnership analysis
        const expenseIds = uniqueExpenses.map((exp: any) => exp.id);
        const { data: allParticipants, error: participantsError } =
          await supabase
            .from("expense_participants")
            .select(
              `
            expense_id,
            participant_id,
            profiles!expense_participants_participant_id_fkey(name)
          `
            )
            .in("expense_id", expenseIds);

        if (participantsError) throw participantsError;

        // Calculate analytics
        const totalExpenses = uniqueExpenses.reduce(
          (sum: number, exp: any) => sum + parseFloat(exp.amount),
          0
        );
        const expenseCount = uniqueExpenses.length;
        const avgExpenseAmount = totalExpenses / expenseCount;

        // Monthly spending analysis
        const monthlyData: { [key: string]: number } = {};
        uniqueExpenses.forEach((exp: any) => {
          const date = new Date(exp.created_at);
          const monthKey = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;
          monthlyData[monthKey] =
            (monthlyData[monthKey] || 0) + parseFloat(exp.amount);
        });

        const monthlySpending = Object.entries(monthlyData)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-6) // Last 6 months
          .map(([month, amount]) => ({
            month: new Date(month + "-01").toLocaleDateString("en", {
              month: "short",
              year: "2-digit",
            }),
            amount: Math.round(amount),
          }));

        // Category breakdown
        const categoryData: { [key: string]: number } = {};
        uniqueExpenses.forEach((exp: any) => {
          const category = exp.category?.toLowerCase() || "other";
          categoryData[category] =
            (categoryData[category] || 0) + parseFloat(exp.amount);
        });

        const categoryBreakdown = Object.entries(categoryData)
          .map(([category, amount]) => ({
            category: category.charAt(0).toUpperCase() + category.slice(1),
            amount: Math.round(amount as number),
            color:
              categoryColors[category as keyof typeof categoryColors] ||
              categoryColors.other,
          }))
          .sort((a, b) => b.amount - a.amount);

        // Top partners analysis
        const partnerData: {
          [key: string]: { count: number; amount: number; name: string };
        } = {};

        uniqueExpenses.forEach((exp: any) => {
          const participants =
            allParticipants?.filter((p: any) => p.expense_id === exp.id) || [];
          const expenseAmount = parseFloat(exp.amount);

          participants.forEach((participant: any) => {
            if (participant.participant_id !== user.id) {
              const partnerId = participant.participant_id;
              if (!partnerData[partnerId]) {
                partnerData[partnerId] = {
                  count: 0,
                  amount: 0,
                  name: participant.profiles?.name || "Unknown",
                };
              }
              partnerData[partnerId].count++;
              partnerData[partnerId].amount +=
                expenseAmount / participants.length;
            }
          });

          // Also count when user bought for others
          if (exp.buyer_id === user.id) {
            const participants =
              allParticipants?.filter((p: any) => p.expense_id === exp.id) ||
              [];
            participants.forEach((participant: any) => {
              if (participant.participant_id !== user.id) {
                const partnerId = participant.participant_id;
                if (!partnerData[partnerId]) {
                  partnerData[partnerId] = {
                    count: 0,
                    amount: 0,
                    name: participant.profiles?.name || "Unknown",
                  };
                }
                // Don't double count, this is already counted above
              }
            });
          }
        });

        const topPartners = Object.values(partnerData)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map((partner) => ({
            name: partner.name,
            count: partner.count,
            amount: Math.round(partner.amount),
          }));

        // Generate insights
        const insights: Array<{
          type: "positive" | "warning" | "info";
          message: string;
        }> = [];

        if (monthlySpending.length >= 2) {
          const lastMonth = monthlySpending[monthlySpending.length - 1];
          const prevMonth = monthlySpending[monthlySpending.length - 2];
          const change =
            ((lastMonth.amount - prevMonth.amount) / prevMonth.amount) * 100;

          if (change > 20) {
            insights.push({
              type: "warning",
              message: `Your spending increased by ${Math.round(
                change
              )}% last month`,
            });
          } else if (change < -20) {
            insights.push({
              type: "positive",
              message: `Great! You reduced spending by ${Math.round(
                Math.abs(change)
              )}% last month`,
            });
          }
        }

        if (categoryBreakdown.length > 0) {
          const topCategory = categoryBreakdown[0];
          const categoryPercentage = (topCategory.amount / totalExpenses) * 100;
          if (categoryPercentage > 50) {
            insights.push({
              type: "info",
              message: `${topCategory.category} accounts for ${Math.round(
                categoryPercentage
              )}% of your expenses`,
            });
          }
        }

        if (avgExpenseAmount > 1000) {
          insights.push({
            type: "info",
            message: `Your average expense is ₹${Math.round(avgExpenseAmount)}`,
          });
        }

        if (topPartners.length > 0) {
          insights.push({
            type: "positive",
            message: `You split most expenses with ${topPartners[0].name} (${topPartners[0].count} expenses)`,
          });
        }

        setAnalysisData({
          totalExpenses: Math.round(totalExpenses),
          monthlySpending,
          categoryBreakdown,
          topPartners,
          avgExpenseAmount: Math.round(avgExpenseAmount),
          expenseCount,
          settlementRatio: 0.8, // This would require balance settlement data
          insights:
            insights.length > 0
              ? insights
              : [
                  {
                    type: "info",
                    message:
                      "Looking good! Keep tracking your expenses for more insights.",
                  },
                ],
        });
      } catch (error) {
        console.error("Analysis fetch error:", error);
        setError("Failed to load analysis data. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalysisData();
  }, [user]);

  const ChartModal = ({
    type,
    data,
    onClose,
  }: {
    type: string;
    data: any;
    onClose: () => void;
  }) => (
    <Modal isOpen={true} onClose={onClose}>
      <div className="max-h-[90vh] overflow-hidden flex flex-col">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-200 px-6 py-4 rounded-t-3xl">
          <h2 className="text-xl font-bold text-gray-900">
            {type === "monthly" && "Monthly Spending Trend"}
            {type === "category" && "Category Breakdown"}
            {type === "partners" && "Top Expense Partners"}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="h-80">
            {type === "monthly" && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={3}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}

            {type === "category" && (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    dataKey="amount"
                    label={({ category, percent }) =>
                      `${category} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {data.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            )}

            {type === "partners" && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" />
                  <Bar dataKey="count" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing your expenses...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analysisData) return null;

  return (
    <div className="pb-6">
      <div className="space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FaRupeeSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">
                  ₹{analysisData.totalExpenses.toLocaleString()}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  Total Expenses
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <FiBarChart className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">
                  {analysisData.expenseCount}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  Total Expenses
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Average & Insights */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-purple-600 mb-1">
              ₹{analysisData.avgExpenseAmount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">Average per expense</div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <div className="space-y-3">
              {analysisData.insights.map((insight, index) => (
                <div
                  key={index}
                  className={`flex items-start gap-3 p-3 rounded-xl ${
                    insight.type === "positive"
                      ? "bg-green-50 border border-green-200"
                      : insight.type === "warning"
                      ? "bg-yellow-50 border border-yellow-200"
                      : "bg-blue-50 border border-blue-200"
                  }`}
                >
                  {insight.type === "positive" && (
                    <FiTrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
                  )}
                  {insight.type === "warning" && (
                    <FiAlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  )}
                  {insight.type === "info" && (
                    <FiActivity className="w-5 h-5 text-blue-600 mt-0.5" />
                  )}
                  <p
                    className={`text-sm font-medium ${
                      insight.type === "positive"
                        ? "text-green-800"
                        : insight.type === "warning"
                        ? "text-yellow-800"
                        : "text-blue-800"
                    }`}
                  >
                    {insight.message}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chart Cards */}
        {/* {analysisData.monthlySpending.length > 0 && (
          <div
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
            onClick={() => setSelectedChart("monthly")}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                  <FiTrendingUp className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Monthly Trend</h3>
                  <p className="text-sm text-gray-500">Last 6 months</p>
                </div>
              </div>
              <FiBarChart className="w-5 h-5 text-gray-400" />
            </div>

            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={analysisData.monthlySpending}>
                  <Line
                    type="monotone"
                    dataKey="amount"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )} */}

        {analysisData.categoryBreakdown.length > 0 && (
          <div
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
            onClick={() => setSelectedChart("category")}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                  <FiPieChart className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Categories</h3>
                  <p className="text-sm text-gray-500">Spending breakdown</p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {analysisData.categoryBreakdown
                .slice(0, 3)
                .map((category, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {category.category}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">
                      ₹{category.amount.toLocaleString()}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {analysisData.topPartners.length > 0 && (
          <div
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md transition-all active:scale-[0.98]"
            onClick={() => setSelectedChart("partners")}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <FiUsers className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Top Partners</h3>
                  <p className="text-sm text-gray-500">Most shared expenses</p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {analysisData.topPartners.slice(0, 3).map((partner, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">
                        {partner.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {partner.name}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-900">
                      {partner.count} expenses
                    </div>
                    <div className="text-xs text-gray-500">
                      ₹{partner.amount.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart Modals */}
      {selectedChart === "monthly" && (
        <ChartModal
          type="monthly"
          data={analysisData.monthlySpending}
          onClose={() => setSelectedChart(null)}
        />
      )}

      {selectedChart === "category" && (
        <ChartModal
          type="category"
          data={analysisData.categoryBreakdown}
          onClose={() => setSelectedChart(null)}
        />
      )}

      {selectedChart === "partners" && (
        <ChartModal
          type="partners"
          data={analysisData.topPartners}
          onClose={() => setSelectedChart(null)}
        />
      )}
    </div>
  );
};

export default Analysis;
