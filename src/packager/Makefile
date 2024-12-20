PROJECT=packager
sinclude ../Makefile.include

.PHONY: all clean lint install test watch

all: install test

clean:
	rm -rf .pytest_cache

install:
	poetry install
	poetry run mypy --install-types

test: lint
	poetry run pytest

watch:
	poetry run ptw --now .

lint: install
	poetry run mypy packager
	poetry run black .
