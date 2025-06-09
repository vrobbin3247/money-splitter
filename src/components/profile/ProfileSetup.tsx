import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function ProfileSetup() {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !name) return;
    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          name
        });

      if (error) throw error;
      navigate('/');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Profile setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Complete Your Profile</h1>
      <p className="mb-4">Please enter your name to continue.</p>
      
      {error && <p className="text-red-500 mb-4">{error}</p>}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="name" className="block mb-2">Your Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded"
            required
            minLength={2}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          disabled={loading || !name.trim()}
        >
          {loading ? 'Saving...' : 'Continue'}
        </button>
      </form>
    </div>
  );
}
