# https://gist.githubusercontent.com/nqbao/9a9c22298a76584249501b74410b8475/raw/7d1410028d4243759dd7578e8460d17178180291/ssm_parameter_store.py
# Copyright (c) 2018 Bao Nguyen <b@nqbao.com>
#
# Permission is hereby granted, free of charge, to any person obtaining a copy
# of this software and associated documentation files (the "Software"), to deal
# in the Software without restriction, including without limitation the rights
# to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
# copies of the Software, and to permit persons to whom the Software is
# furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included in all
# copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
# ==============================================================================

import boto3  # type: ignore

# from botocore.exceptions import ClientError
import datetime
from typing import Any, List, Optional, TYPE_CHECKING
from .types import KEYED

if TYPE_CHECKING:
    from botocore.client import BaseClient  # type: ignore


class SSMParameterStore(object):
    def __init__(
        self,
        prefix: Optional[str] = None,
        region: str = "us-east-1",
        ttl: Optional[int] = None,
    ) -> None:
        base = (prefix or "").strip("/").lstrip("SSM")
        self._prefix = f"/{base}/" if base else "/"
        self._region = region
        self._client: BaseClient = boto3.client("ssm", region_name=region)
        self._keys: KEYED = {}
        self._substores: KEYED = {}
        self._ttl = ttl

    def get(self, name: str, **kwargs: Any) -> Any:
        assert name, "Name can not be empty"
        if self._keys is None:
            self.refresh()

        abs_key = "%s%s" % (self._prefix, name)
        if name not in self._keys:
            if "default" in kwargs:
                return kwargs["default"]

            raise KeyError(name)
        elif self._keys[name]["type"] == "prefix":
            if abs_key not in self._substores:
                store = self.__class__(
                    prefix=abs_key, region=self._region, ttl=self._ttl
                )
                store._keys = self._keys[name]["children"]
                self._substores[abs_key] = store

            return self._substores[abs_key]
        else:
            return self._get_value(name, abs_key)

    def put(self, name: str, value: Any, **kwargs: Any) -> None:
        assert name, "Name can not be empty"
        assert value, "Value can not be empty"

        abs_key = "%s%s" % (self._prefix, name)
        if isinstance(value, list):
            value = ",".join(value)

        self._client.put_parameter(
            Name=abs_key, Value=value, Type="String", Overwrite=True
        )

        if self._keys is not None:
            self._keys[name] = {"type": "parameter", "value": value}

    def refresh(self) -> None:
        self._keys = {}
        self._substores = {}

        paginator = self._client.get_paginator("describe_parameters")
        pager = paginator.paginate(
            ParameterFilters=[
                dict(Key="Path", Option="Recursive", Values=[self._prefix])
            ]
        )

        for page in pager:
            for p in page["Parameters"]:
                paths = p["Name"][len(self._prefix) :].split("/")
                self._update_keys(self._keys, paths)

    @classmethod
    def _update_keys(cls, keys: KEYED, paths: List[str]) -> None:
        name = paths[0]

        # this is a prefix
        if len(paths) > 1:
            if name not in keys:
                keys[name] = {"type": "prefix", "children": {}}

            cls._update_keys(keys[name]["children"], paths[1:])
        else:
            keys[name] = {"type": "parameter", "expire": None}

    def keys(self) -> List[str]:
        if self._keys is None:
            self.refresh()

        return list(self._keys.keys())

    def _get_value(self, name: str, abs_key: str) -> Any:
        entry = self._keys[name]

        # simple ttl
        if self._ttl is False or (
            "expire" in entry and entry["expire"] <= datetime.datetime.now()
        ):
            entry.pop("value", None)

        if "value" not in entry:
            parameter = self._client.get_parameter(Name=abs_key, WithDecryption=True)[
                "Parameter"
            ]
            value = parameter["Value"]
            if parameter["Type"] == "StringList":
                value = value.split(",")

            entry["value"] = value

            if self._ttl:
                entry["expire"] = datetime.datetime.now() + datetime.timedelta(
                    seconds=self._ttl
                )
            else:
                entry["expire"] = None

        return entry["value"]

    def __contains__(self, name: str) -> bool:
        try:
            self.get(name)
            return True
        except KeyError:
            return False

    def __getitem__(self, name: str) -> Any:
        return self.get(name)

    def __setitem__(self, key: str, value: Any) -> None:
        self.put(key, value)

    def __delitem__(self, name: str) -> None:
        raise NotImplementedError()

    def __repr__(self) -> str:
        return "ParameterStore[%s]" % self._prefix
