PROJECT=packager
sinclude ../Makefile.include

.PHONY: all clean lint install test watch

all: install test

clean:
	rm -rf .pytest_cache

install:
	poetry install

test: lint
	poetry run pytest

watch:
	poetry run ptw --now .

lint:
	poetry run mypy .
	poetry run black .
