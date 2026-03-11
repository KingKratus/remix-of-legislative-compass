
CREATE TABLE public.sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  status text NOT NULL DEFAULT 'running',
  votacoes_processadas integer DEFAULT 0,
  deputados_atualizados integer DEFAULT 0,
  started_at timestamptz DEFAULT now(),
  finished_at timestamptz,
  message text
);
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sync logs publicly readable" ON public.sync_logs FOR SELECT TO public USING (true);
CREATE POLICY "No public insert" ON public.sync_logs FOR INSERT TO public WITH CHECK (false);
CREATE POLICY "No public update" ON public.sync_logs FOR UPDATE TO public USING (false);
CREATE POLICY "No public delete" ON public.sync_logs FOR DELETE TO public USING (false);
