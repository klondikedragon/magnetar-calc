"""Independent mathematical oracle used only by npm run test:oracle.

It deliberately does not parse Calculator expressions. JavaScript supplies a
small operation descriptor and compares its own evaluated result against a
separate SymPy or mpmath calculation.
"""

import json
import sys

import mpmath as mp
from sympy import bell, binomial, catalan, factorial, fibonacci, lucas
from sympy.functions.combinatorial.numbers import stirling


def exact(operation, arguments):
    values = [int(argument) for argument in arguments]
    if operation == "factorial":
        return factorial(values[0])
    if operation == "power":
        return values[0] ** values[1]
    if operation == "binomial":
        return binomial(values[0], values[1])
    if operation == "fibonacci":
        return fibonacci(values[0])
    if operation == "lucas":
        return lucas(values[0])
    if operation == "catalan":
        return catalan(values[0])
    if operation == "bell":
        return bell(values[0])
    if operation == "stirling2":
        return stirling(values[0], values[1], kind=2)
    raise ValueError(f"Unknown exact operation: {operation}")


def decimal_argument(argument):
    if argument == "pi":
        return mp.pi
    if argument == "e":
        return mp.e
    if argument.startswith("pi/"):
        return mp.pi / mp.mpf(argument.removeprefix("pi/"))
    return mp.mpf(argument)


def transcendental(operation, arguments, digits):
    mp.mp.dps = digits
    values = [decimal_argument(argument) for argument in arguments]
    operations = {
        "pi": lambda: mp.pi,
        "e": lambda: mp.e,
        "sqrt": lambda: mp.sqrt(values[0]),
        "ln": lambda: mp.log(values[0]),
        "log10": lambda: mp.log10(values[0]),
        "sin": lambda: mp.sin(values[0]),
        "cos": lambda: mp.cos(values[0]),
        "tan": lambda: mp.tan(values[0]),
        "atan": lambda: mp.atan(values[0]),
        "exp": lambda: mp.exp(values[0]),
    }
    if operation not in operations:
        raise ValueError(f"Unknown transcendental operation: {operation}")
    return mp.nstr(operations[operation](), n=digits)


def evaluate(case):
    if case["kind"] == "exact":
        return str(exact(case["operation"], case["arguments"]))
    if case["kind"] == "transcendental":
        return transcendental(case["operation"], case.get("arguments", []), case.get("digits", 90))
    raise ValueError(f"Unknown oracle case kind: {case['kind']}")


def main():
    cases = json.load(sys.stdin)
    print(json.dumps({case["id"]: evaluate(case) for case in cases}))


if __name__ == "__main__":
    main()
