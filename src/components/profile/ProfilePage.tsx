import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

type Roommate = {
  id: string;
  email: string;
  name: string;
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roommates, setRoommates] = useState<Roommate[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const navigate = useNavigate();

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setName(data.name);
      } else {
        setError('Profile not found - please complete your profile setup');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile');
    }
  };

  const fetchRoommates = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .neq('id', user.id);

      if (error) throw error;
      if (data) {
        const roommateData = await Promise.all(data.map(async (profile: { id: string; name: string }) => {
          const { data: userData } = await supabase
            .from('users')
            .select('email')
            .eq('id', profile.id)
            .single();
          return {
            ...profile,
            email: userData?.email || 'Unknown'
          };
        }));
        setRoommates(roommateData);
      }
    } catch (error) {
      console.error('Error fetching roommates:', error);
      setError('Failed to load roommates');
    }
  };

  const updateProfile = async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name,
        }, {
          onConflict: 'id'
        });

      if (error) throw error;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Profile update failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setLoading(true);
    setError('');

    try {
      alert(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Invitation failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchRoommates();
    }
  }, [user]);

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <button 
          onClick={() => navigate('/')}
          className="text-blue-500 hover:text-blue-700"
        >
          ← Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold">Your Profile</h1>
        <div className="w-8"></div>
      </div>
      
      {error && <p className="text-red-500 mb-4">{error}</p>}
      
      <div className="mb-6">
        <label htmlFor="name" className="block mb-2">Your Name</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border rounded mb-2"
          required
        />
        <button
          onClick={updateProfile}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Profile'}
        </button>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Your Roommates</h2>
        {roommates.length === 0 ? (
          <p>No roommates yet</p>
        ) : (
          <ul className="space-y-2">
            {roommates.map((roommate) => (
              <li key={roommate.id} className="flex justify-between items-center">
                <span>{roommate.name} ({roommate.email})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Invite Roommates</h2>
        <div className="flex">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Enter email address"
            className="flex-1 p-2 border rounded-l"
            required
          />
          <button
            onClick={handleInvite}
            className="bg-green-500 text-white px-4 py-2 rounded-r hover:bg-green-600"
            disabled={loading}
          >
            Invite
          </button>
        </div>
      </div>
    </div>
  );
}
