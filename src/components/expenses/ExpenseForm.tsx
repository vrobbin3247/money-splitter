import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { FaPlus, FaTimes, FaCheck } from "react-icons/fa";
import { categories } from "../constants/categories";
// import { GiMoneyStack } from "react-icons/gi";
import { FaIndianRupeeSign } from "react-icons/fa6";

interface Profile {
  id: string;
  name: string;
}

interface ExpenseFormData {
  title: string;
  amount: number;
  category: "food" | "travel" | "rent" | "utilities" | "misc";
  participants: string[];
}

interface ExpenseFormProps {
  asPopup?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function ExpenseForm({
  asPopup = false,
  onSuccess,
  onCancel,
}: ExpenseFormProps) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [formData, setFormData] = useState<ExpenseFormData>({
    title: "",
    amount: 0,
    category: "misc",
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
      }, 100);
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

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === "amount" ? parseFloat(value) || 0 : value,
    }));
  };

  const handleCategoryChange = (
    category: "food" | "travel" | "rent" | "utilities" | "misc"
  ) => {
    setFormData((prev) => ({
      ...prev,
      category,
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
        throw new Error("Please fill all required fields");
      }

      const { data: expense, error: expenseError } = await supabase
        .from("expenses")
        .insert({
          title: formData.title,
          amount: formData.amount,
          buyer_id: user?.id,
          category: formData.category,
        })
        .select()
        .single();

      if (expenseError) throw expenseError;

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
        category: "misc",
        participants: user ? [user.id] : [],
      });

      if (asPopup) {
        setTimeout(() => {
          setShowModal(false);
          onSuccess?.();
        }, 1000);
      } else {
        onSuccess?.();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error creating expense");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: "",
      amount: 0,
      category: "misc",
      participants: user ? [user.id] : [],
    });
    setError(null);
    setSuccess(false);
  };

  const renderFormContent = () => (
    <>
      {error && (
        <div className="p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded flex items-center gap-2">
          <FaTimes className="flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 mb-4 bg-green-100 border border-green-400 text-green-700 rounded flex items-center gap-2">
          <FaCheck className="flex-shrink-0" />
          <span>Expense added successfully!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="title"
            className="block mb-2 text-sm font-medium text-gray-700"
          >
            Title
          </label>
          <input
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            placeholder="What was this expense for?"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div>
          <label
            htmlFor="amount"
            className="block mb-2 text-sm font-medium text-gray-700"
          >
            Amount
          </label>
          <div className="relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaIndianRupeeSign className="text-gray-400" />
            </div>
            <input
              id="amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              value={formData.amount || ""}
              onChange={handleInputChange}
              required
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Category
          </label>
          <div className="grid grid-cols-5 gap-2">
            {categories.map((cat) => (
              <button
                type="button"
                key={cat.value}
                onClick={() => handleCategoryChange(cat.value as any)}
                className={`p-2 rounded-lg border flex flex-col items-center justify-center transition-colors ${
                  formData.category === cat.value
                    ? "bg-blue-100 border-blue-500"
                    : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                }`}
                aria-label={cat.label}
              >
                <span className="text-xl mb-1">{cat.icon}</span>
                <span className="text-sm">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block mb-2 text-sm font-medium text-gray-700">
            Participants
          </label>
          <div className="flex flex-wrap gap-2">
            {profiles.map((profile) => {
              const isSelected = formData.participants.includes(profile.id);
              return (
                <button
                  type="button"
                  key={profile.id}
                  onClick={() => handleCheckboxChange(profile.id)}
                  className={`px-3 py-1 rounded-full border text-sm transition-colors ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-700"
                      : "bg-gray-100 text-gray-800 border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {profile.name} {profile.id === user?.id && "(You)"}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600">Amount per person:</p>
          <p className="text-xl font-bold text-gray-800">
            ₹{amountPerPerson.toFixed(2)}
          </p>
        </div>

        <div className="flex gap-3">
          {asPopup && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowModal(false);
                onCancel?.();
              }}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={loading}
            className={`flex-1 px-4 py-2 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
              loading
                ? "bg-blue-400 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
            }`}
          >
            {loading ? "Processing..." : "Add Expense"}
          </button>
        </div>
      </form>
    </>
  );

  if (asPopup) {
    return (
      <>
        <button
          onClick={() => setShowModal(true)}
          className="fixed bottom-6 right-6 bg-blue-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-colors z-40"
          aria-label="Add new expense"
        >
          <FaPlus className="text-xl" />
        </button>

        <div
          className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 transition-opacity duration-300 ${
            showModal ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => {
            setShowModal(false);
            resetForm();
          }}
        >
          <div
            className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                {/* <h2 className="text-xl font-semibold text-gray-800">
                  Add New Expense
                </h2> */}
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-500 hover:text-gray-700 text-2xl focus:outline-none"
                  aria-label="Close"
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
    <div className="p-6 bg-white rounded-lg shadow-md">
      {renderFormContent()}
    </div>
  );
}
