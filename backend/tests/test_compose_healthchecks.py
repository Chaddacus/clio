"""The compose `db` healthchecks must probe a database that exists.

`pg_isready` without `-d` connects to a database named after the user. In
docker-compose.prod.yml the user is `clio` but the database is `clio_db`, so
Postgres logged `FATAL: database "clio" does not exist` on every 10 s probe
(about 8.6k lines a day, issue #49). The probe still reported "healthy", which
is why nothing failed and the noise hid real database errors.

These tests read the compose files and work out, as Compose would, which
database each probe targets and which database the container creates.
"""
import re
import shlex
from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[2]
COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.prod.yml']

# Every Postgres image creates this maintenance database, whatever POSTGRES_DB is.
MAINTENANCE_DB = 'postgres'

_VARIABLE = re.compile(r'\$\{(\w+)(?::-([^}]*))?\}')


def interpolate(text, env):
    """Expand ${VAR} and ${VAR:-default} the way Compose does (default if unset or empty)."""
    return _VARIABLE.sub(lambda m: env.get(m.group(1)) or m.group(2) or '', text)


def option(args, flag):
    return args[args.index(flag) + 1] if flag in args else None


def load_db_service(compose_name):
    path = REPO_ROOT / compose_name
    if not path.exists():
        # The backend container mounts only ./backend, so the compose files are not there.
        pytest.skip(f'{compose_name} is not available from this checkout')
    return yaml.safe_load(path.read_text())['services']['db']


@pytest.mark.parametrize('env', [{}, {'DB_NAME': 'other_db', 'DB_USER': 'other_user'}], ids=['defaults', 'overridden'])
@pytest.mark.parametrize('compose_name', COMPOSE_FILES)
def test_db_healthcheck_probes_a_database_that_exists(compose_name, env):
    db = load_db_service(compose_name)
    kind, command = db['healthcheck']['test'][:2]
    assert kind == 'CMD-SHELL'

    args = shlex.split(interpolate(command, env))
    assert args[0] == 'pg_isready'
    user = option(args, '-U')
    assert user, 'pg_isready needs -U so the probe does not depend on the container user'
    # With no -d, pg_isready targets a database named after the user.
    probed = option(args, '-d') or user

    environment = db['environment']
    created = interpolate(environment.get('POSTGRES_DB') or environment['POSTGRES_USER'], env)
    assert probed in {created, MAINTENANCE_DB}, (
        f'{compose_name}: the db healthcheck probes database "{probed}" but the container creates '
        f'"{created}". Postgres logs FATAL "database does not exist" on every probe. Pass -d.'
    )
    assert user == interpolate(environment['POSTGRES_USER'], env)
