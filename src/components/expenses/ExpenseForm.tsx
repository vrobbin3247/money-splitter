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
  onSuccess?: () => void;
  onCancel?: () => void;
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

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  useEffect(() => {
    if (showModal) {
      setTimeout(() => {
        document.getElementById("title")?.focus();
      }, 100); // small delay for modal to render
    }
  }, [showModal]);

  const fetchProfiles = async () => {
    const { data, error } = await supabase.from("profiles").select("id, name");
    if (error) {
      setError("Failed to fetch profiles");
      console.error(error);
      return;
    }
    setProfiles(data || []);
  };

  const calculateAmountPerPerson = () => {
    const count = formData.participants.length || 1;
    setAmountPerPerson(formData.amount / count);
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
      const updated = prev.participants.includes(profileId)
        ? prev.participants.filter((id) => id !== profileId)
        : [...prev.participants, profileId];
      return { ...prev, participants: updated };
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
        throw new Error("Please fill all fields and select participants");
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

      if (expense.buyer_id !== user?.id) {
        throw new Error("You're not authorized to add participants");
      }

      const participantsData = formData.participants.map((id) => ({
        expense_id: expense.id,
        participant_id: id,
      }));

      const { error: participantsError } = await supabase
        .from("expense_participants")
        .insert(participantsData);

      if (participantsError) throw participantsError;

      setSuccess(true);
      setFormData({
        title: "",
        amount: 0,
        participants: user ? [user.id] : [],
      });

      if (asPopup) setTimeout(() => setShowModal(false), 1500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating expense");
    } finally {
      setLoading(false);
    }
  };

  const renderFormContent = () => (
    <>
      {error && <p className="text-red-600">{error}</p>}
      {success && (
        <div className="flex items-center gap-2 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          = <span>Expense added successfully!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="title" className="block mb-1 text-sm font-medium">
            Title
          </label>
          <input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="What was this expense for?"
            required
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label htmlFor="amount" className="block mb-1 text-sm font-medium">
            Amount
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            min="1"
            value={formData.amount || ""}
            onChange={handleInputChange}
            required
            className="w-full border rounded p-2"
          />
        </div>

        <div>
          <label className="block mb-1 text-sm font-medium">Participants</label>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => {
              const isSelected = formData.participants.includes(profile.id);
              return (
                <button
                  type="button"
                  key={profile.id}
                  onClick={() => handleCheckboxChange(profile.id)}
                  className={`px-3 py-1 rounded-full border text-sm ${
                    isSelected
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {profile.name} {profile.id === user?.id && "(You)"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded">
          <p className="text-sm">Amount per person:</p>
          <p className="text-xl font-bold">₹{amountPerPerson.toFixed(2)}</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gray-800 text-white py-2 rounded hover:bg-gray-700 disabled:opacity-50"
        >
          {loading ? "Adding..." : "Add Expense"}
        </button>
      </form>
    </>
  );

  if (asPopup) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="fixed bottom-6 right-6 bg-gray-800 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:bg-gray-700"
        >
          <span className="text-2xl">+</span>
        </button>

        <div
          className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ${
            showModal ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Add Expense</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  &times;
                </button>
              </div>
              {renderFormContent()}
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h2 className="text-xl font-semibold mb-4">Add Expense</h2>
      {renderFormContent()}
    </div>
  );
}
