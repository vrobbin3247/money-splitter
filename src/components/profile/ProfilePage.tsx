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
  const [inviteEmail, setInviteEmail] = useState("");
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
    try {
      const { error } = await supabase.from("profiles").upsert(
        {
          id: user.id,
          name,
          upi_id: upiId, // Added UPI ID to update
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
    <div className="min-h-screen bg-[#fdfaf6] px-4 pt-6 pb-20 text-gray-800">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate("/")}
          className="text-sm text-blue-600 hover:underline"
        >
          ← Dashboard
        </button>
        <h1 className="text-xl font-semibold">Your Profile</h1>
        <div className="w-6"></div>
      </div>

      {error && <p className="text-red-500 mb-4 text-sm">{error}</p>}

      {/* Profile Edit Section */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <label htmlFor="name" className="block mb-2 font-medium">
          Your Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg mb-4"
          required
        />

        <label htmlFor="upiId" className="block mb-2 font-medium">
          UPI ID
        </label>
        <input
          id="upiId"
          type="text"
          value={upiId}
          onChange={(e) => setUpiId(e.target.value)}
          placeholder="yourname@upi"
          className="w-full p-2 border border-gray-300 rounded-lg mb-4"
        />
        <small className="text-gray-500 text-sm block mb-4">
          Add your UPI ID to receive payments from roommates
        </small>

        <button
          onClick={updateProfile}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
          disabled={loading}
        >
          {loading ? "Saving..." : "Save Profile"}
        </button>
      </div>

      {/* Roommate List */}
      <div className="bg-white rounded-xl shadow p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Roommates</h2>
        {roommates.length === 0 ? (
          <p className="text-sm text-gray-500">No roommates yet</p>
        ) : (
          <ul className="divide-y">
            {roommates.map((r) => (
              <li key={r.id} className="py-2 text-sm">
                <span className="font-medium">{r.name}</span>
                {/* <span className="text-gray-600">{r.email}</span> */}
                {r.upi_id && r.upi_id !== "Not set" && (
                  <div className="text-xs text-green-600 mt-1">
                    UPI: {r.upi_id}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invite Roommate */}
      {/* <div className="bg-white rounded-xl shadow p-4">
        <h2 className="text-lg font-semibold mb-3">Invite a Roommate</h2>
        <div className="flex">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Enter email"
            className="flex-1 p-2 border border-gray-300 rounded-l-lg"
            required
          />
          <button
            onClick={handleInvite}
            className="bg-green-600 text-white px-4 py-2 rounded-r-lg hover:bg-green-700 transition"
            disabled={loading}
          >
            Invite
          </button>
        </div>
      </div> */}
    </div>
  );
}
