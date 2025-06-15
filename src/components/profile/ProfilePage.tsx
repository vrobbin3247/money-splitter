import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";

type Roommate = {
  id: string;
  email: string;
  name: string;
  upi_id: string; // Added UPI ID to roommate type
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [upiId, setUpiId] = useState(""); // New state for UPI ID
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  // const [inviteEmail, setInviteEmail] = useState("");
  const navigate = useNavigate();

  const fetchProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setName(data.name);
        setUpiId(data.upi_id || ""); // Set UPI ID from profile
      } else setError("Profile not found - please complete your profile setup");
    } catch (error) {
      console.error("Error fetching profile:", error);
      setError("Failed to load profile");
    }
  };

  const fetchRoommates = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, upi_id") // Added upi_id to selection
        .neq("id", user.id);
      if (error) throw error;
      if (data) {
        const roommateData = await Promise.all(
          data.map(async (profile) => {
            const { data: userData } = await supabase
              .from("users")
              .select("email")
              .eq("id", profile.id)
              .single();
            return {
              ...profile,
              email: userData?.email || "Unknown",
              upi_id: profile.upi_id || "Not set",
            };
          })
        );
        setRoommates(roommateData);
      }
    } catch (error) {
      console.error("Error fetching roommates:", error);
      setError("Failed to load roommates");
    }
  };

  const updateProfile = async () => {
    if (!user) return;
    setLoading(true);
    setError("");

    // Basic UPI ID validation
    if (upiId && !upiId.match(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/)) {
      setError("Please enter a valid UPI ID (e.g. name@upi)");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          name,
          upi_id: upiId,
        },
        { onConflict: "id" }
      );
      if (error) throw error;
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Profile update failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // ... rest of your existing functions (handleInvite, etc.)

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchRoommates();
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-6 pb-20 text-gray-800">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate("/")}
          className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
          Dashboard
        </button>
        <h1 className="text-xl font-semibold text-gray-800">Your Profile</h1>
        <div className="w-6"></div> {/* Spacer for alignment */}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Profile Edit Section */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">
          Profile Details
        </h2>

        <div className="mb-4">
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Your Name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            required
            placeholder="Enter your full name"
          />
        </div>

        <div className="mb-6">
          <label
            htmlFor="upiId"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            UPI ID
          </label>
          <input
            id="upiId"
            type="text"
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="yourname@upi"
            className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
          />
          <p className="mt-2 text-xs text-gray-500">
            Add your UPI ID to receive payments from roommates
          </p>
        </div>

        <button
          onClick={updateProfile}
          className="w-full bg-blue-600 text-white p-3 rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={loading}
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
            "Save Profile"
          )}
        </button>
      </div>

      {/* Roommate List */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Roommates</h2>
        {roommates.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No roommates yet</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {roommates.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-800">{r.name}</span>
                  {r.upi_id && r.upi_id !== "Not set" && (
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full">
                      UPI: {r.upi_id}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Commented Invite Roommate Section */}
      {/* <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4 text-gray-800">Invite a Roommate</h2>
        <div className="flex">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Enter email address"
            className="flex-1 p-3 border border-gray-200 rounded-l-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            required
          />
          <button
            onClick={handleInvite}
            className="bg-green-600 text-white px-4 py-3 rounded-r-lg font-medium hover:bg-green-700 active:bg-green-800 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50"
            disabled={loading}
          >
            Invite
          </button>
        </div>
      </div> */}
    </div>
  );
}
