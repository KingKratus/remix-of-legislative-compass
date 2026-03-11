import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Tables<"profiles">;

export function useProfile(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!userId) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setProfile(data);
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const toggleFavorite = useCallback(async (deputadoId: number) => {
    if (!userId || !profile) return;
    const current = profile.favoritos || [];
    const next = current.includes(deputadoId)
      ? current.filter((id) => id !== deputadoId)
      : [...current, deputadoId];

    const { error } = await supabase
      .from("profiles")
      .update({ favoritos: next })
      .eq("user_id", userId);

    if (!error) {
      setProfile({ ...profile, favoritos: next });
    }
  }, [userId, profile]);

  const isFavorite = useCallback((deputadoId: number) => {
    return (profile?.favoritos || []).includes(deputadoId);
  }, [profile]);

  return { profile, loading, toggleFavorite, isFavorite, refetch: fetchProfile };
}
