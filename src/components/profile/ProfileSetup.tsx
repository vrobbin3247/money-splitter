import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function ProfileSetup() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [upiId, setUpiId] = useState(""); // New state for UPI ID
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;
    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.from("profiles").insert({
        id: user.id,
        name,
        upi_id: upiId, // Add UPI ID to profile creation
      });

      if (error) throw error;
      navigate("/");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Profile setup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 pb-safe">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            Complete Your Profile
          </h1>
          <p className="text-gray-600">Set up your account details</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              profile name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              required
              minLength={2}
              placeholder=""
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="upiId"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              UPI ID (Optional)
            </label>
            <input
              id="upiId"
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              placeholder="yourname@upi"
            />
            <p className="mt-2 text-xs text-gray-500">
              Add now or later in profile settings. Needed to receive payments.
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={loading || !name.trim()}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Saving...
              </span>
            ) : (
              "Continue"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
