"""
Direct en temps réel (Supabase Realtime) et verrouillage des tables.

Uniquement sur la base Supabase (PostgreSQL avec le schéma « realtime ») ; sans effet en local (SQLite).

- RLS activé sur toutes les tables publiques : la clé publique Supabase, visible par les navigateurs,
  ne donne accès à aucune table. Django se connecte avec le rôle propriétaire, qui n'est pas concerné.
- À chaque modification d'un match, la base envoie « ce match a changé » sur le canal privé « match:<id> ».
  Le message ne contient que l'id : la page relit le match auprès de l'API, comme avant.
- Les navigateurs peuvent écouter ces canaux, mais pas y envoyer de message (aucune règle d'écriture).
"""
from django.db import migrations

RLS_TOUTES_LES_TABLES = """
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
"""

SIGNAL_MATCH = """
CREATE OR REPLACE FUNCTION public.tournois_match_signaler() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  match_id bigint;
BEGIN
  IF TG_OP = 'DELETE' THEN match_id := OLD.id; ELSE match_id := NEW.id; END IF;
  PERFORM realtime.send(jsonb_build_object('id', match_id), 'change', 'match:' || match_id, true);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS tournois_match_signaler ON public.tournois_match;
CREATE TRIGGER tournois_match_signaler
  AFTER INSERT OR UPDATE OR DELETE ON public.tournois_match
  FOR EACH ROW EXECUTE FUNCTION public.tournois_match_signaler();

DROP POLICY IF EXISTS "thelab_ecoute_matchs" ON realtime.messages;
CREATE POLICY "thelab_ecoute_matchs" ON realtime.messages
  FOR SELECT TO anon, authenticated
  USING (realtime.messages.extension = 'broadcast' AND realtime.topic() LIKE 'match:%');
"""

RETIRER_SIGNAL_MATCH = """
DROP TRIGGER IF EXISTS tournois_match_signaler ON public.tournois_match;
DROP FUNCTION IF EXISTS public.tournois_match_signaler();
DROP POLICY IF EXISTS "thelab_ecoute_matchs" ON realtime.messages;
"""


def _supabase(connection):
    if connection.vendor != 'postgresql':
        return False
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace "
            "WHERE n.nspname = 'realtime' AND p.proname = 'send'"
        )
        return cursor.fetchone() is not None


def activer(apps, schema_editor):
    connection = schema_editor.connection
    if connection.vendor == 'postgresql':
        schema_editor.execute(RLS_TOUTES_LES_TABLES, params=None)
    if _supabase(connection):
        schema_editor.execute(SIGNAL_MATCH, params=None)


def desactiver(apps, schema_editor):
    if _supabase(schema_editor.connection):
        schema_editor.execute(RETIRER_SIGNAL_MATCH, params=None)


class Migration(migrations.Migration):

    dependencies = [
        ('tournois', '0020_inscription_equipes'),
    ]

    operations = [
        migrations.RunPython(activer, desactiver),
    ]
