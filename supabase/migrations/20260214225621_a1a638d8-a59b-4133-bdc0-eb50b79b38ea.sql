
-- Enum para classificação
CREATE TYPE public.classificacao_tipo AS ENUM ('Governo', 'Centro', 'Oposição', 'Sem Dados');

-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Tabela votacoes: cache de votações da API da Câmara
CREATE TABLE public.votacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_votacao TEXT NOT NULL UNIQUE,
  data TIMESTAMP WITH TIME ZONE,
  descricao TEXT,
  ano INTEGER NOT NULL,
  sigla_orgao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela orientacoes: orientação do líder do governo por votação
CREATE TABLE public.orientacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  id_votacao TEXT NOT NULL REFERENCES public.votacoes(id_votacao) ON DELETE CASCADE,
  sigla_orgao_politico TEXT NOT NULL,
  orientacao_voto TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(id_votacao, sigla_orgao_politico)
);

-- Tabela analises_deputados: score de alinhamento por deputado por ano
CREATE TABLE public.analises_deputados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deputado_id INTEGER NOT NULL,
  deputado_nome TEXT NOT NULL,
  deputado_partido TEXT,
  deputado_uf TEXT,
  deputado_foto TEXT,
  ano INTEGER NOT NULL,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_votos INTEGER NOT NULL DEFAULT 0,
  votos_alinhados INTEGER NOT NULL DEFAULT 0,
  classificacao classificacao_tipo NOT NULL DEFAULT 'Sem Dados',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(deputado_id, ano)
);

-- Tabela profiles: perfil de usuários logados
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  favoritos INTEGER[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela user_roles
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Function has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function update_updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analises_updated_at
  BEFORE UPDATE ON public.analises_deputados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS: votacoes (public read, no public write)
ALTER TABLE public.votacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Votacoes are publicly readable" ON public.votacoes FOR SELECT USING (true);
CREATE POLICY "Only service role can insert votacoes" ON public.votacoes FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update votacoes" ON public.votacoes FOR UPDATE USING (false);

-- RLS: orientacoes (public read)
ALTER TABLE public.orientacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Orientacoes are publicly readable" ON public.orientacoes FOR SELECT USING (true);
CREATE POLICY "Only service role can insert orientacoes" ON public.orientacoes FOR INSERT WITH CHECK (false);

-- RLS: analises_deputados (public read)
ALTER TABLE public.analises_deputados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Analises are publicly readable" ON public.analises_deputados FOR SELECT USING (true);
CREATE POLICY "Only service role can insert analises" ON public.analises_deputados FOR INSERT WITH CHECK (false);
CREATE POLICY "Only service role can update analises" ON public.analises_deputados FOR UPDATE USING (false);

-- RLS: profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- RLS: user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_votacoes_ano ON public.votacoes(ano);
CREATE INDEX idx_orientacoes_votacao ON public.orientacoes(id_votacao);
CREATE INDEX idx_analises_deputado_ano ON public.analises_deputados(deputado_id, ano);
CREATE INDEX idx_analises_classificacao ON public.analises_deputados(classificacao);
CREATE INDEX idx_analises_ano ON public.analises_deputados(ano);
