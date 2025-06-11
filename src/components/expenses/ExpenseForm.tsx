import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";

interface Profile {
  id: string;
  name: string;
}

interface ExpenseFormData {
  title: string;
  amount: number;
  participants: string[];
}

interface ExpenseFormProps {
  asPopup?: boolean;
}

export default function ExpenseForm({ asPopup = false }: ExpenseFormProps) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [formData, setFormData] = useState<ExpenseFormData>({
    title: "",
    amount: 0,
    participants: user ? [user.id] : [],
  });
  const [amountPerPerson, setAmountPerPerson] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (user?.id) {
      setFormData((prev) => ({
        ...prev,
        participants: [user.id],
      }));
    }
    fetchProfiles();
  }, [user]);

  useEffect(() => {
    calculateAmountPerPerson();
  }, [formData.amount, formData.participants]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name");

      if (error) throw error;
      setProfiles(data || []);
    } catch (err) {
      setError("Failed to fetch profiles");
      console.error(err);
    }
  };

  const calculateAmountPerPerson = () => {
    const participantCount = formData.participants.length || 1;
    setAmountPerPerson(formData.amount / participantCount);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleCheckboxChange = (profileId: string) => {
    setFormData((prev) => {
      const newParticipants = prev.participants.includes(profileId)
        ? prev.participants.filter((id) => id !== profileId)
        : [...prev.participants, profileId];
      return { ...prev, participants: newParticipants };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (
        !formData.title ||
        formData.amount <= 0 ||
        formData.participants.length === 0
      ) {
        throw new Error(
          "Please fill all fields and select at least one participant"
        );
      }

      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          title: formData.title,
          amount: formData.amount,
          buyer_id: user?.id,
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

      // NEW CHECK: Ensure the user is the buyer before adding participants
      if (expense.buyer_id !== user?.id) {
        throw new Error(
          "You are not authorized to add participants to this expense."
        );
      }

      const participantsData = formData.participants.map((participantId) => ({
        expense_id: expense.id,
        participant_id: participantId,
      }));

      const { error: participantsError } = await supabase
        .from("expense_participants")
        .insert(participantsData);

      if (participantsError) throw participantsError;

      setSuccess(true);
      setFormData({
        title: "",
        amount: 0,
        participants: [],
      });

      if (asPopup) {
        setTimeout(() => setShowModal(false), 1500);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create expense");
    } finally {
      setLoading(false);
    }
  };

  if (asPopup) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="fixed bottom-6 right-6 bg-gray-800 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-700 transition-colors z-50"
        >
          <span className="text-2xl">+</span>
        </button>

        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold">Add New Expense</h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    &times;
                  </button>
                </div>
                {renderFormContent()}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Add New Expense</h2>
      {renderFormContent()}
    </div>
  );

  function renderFormContent() {
    return (
      <>
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            Expense added successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="title"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Title
            </label>
            <input
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              placeholder="What was this expense for?"
              required
            />
          </div>

          <div>
            <label
              htmlFor="amount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Amount
            </label>
            <input
              id="amount"
              name="amount"
              type="number"
              min="1"
              step="1"
              value={formData.amount || ""}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm"
              placeholder="0"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Participants
            </label>
            <div className="space-y-2">
              {profiles.map((profile) => (
                <div key={profile.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`participant-${profile.id}`}
                    checked={formData.participants.includes(profile.id)}
                    onChange={() => handleCheckboxChange(profile.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label
                    htmlFor={`participant-${profile.id}`}
                    className="text-sm text-gray-700"
                  >
                    {profile.name} {profile.id === user?.id && "(You)"}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="font-medium">Amount per person:</p>
            <p className="text-xl font-bold">₹{amountPerPerson.toFixed(2)}</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50"
          >
            {loading ? "Processing..." : "Add Expense"}
          </button>
        </form>
      </>
    );
  }
}
