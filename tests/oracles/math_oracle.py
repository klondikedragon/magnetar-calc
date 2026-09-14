"""Independent mathematical oracle used only by npm run test:oracle.

It deliberately does not parse Calculator expressions. JavaScript supplies a
small operation descriptor and compares its own evaluated result against a
separate SymPy or mpmath calculation.
"""

import json
import sys
from math import gcd

import mpmath as mp
from sympy import bell, binomial, catalan, factorial, fibonacci, lucas
from sympy.functions.combinatorial.numbers import stirling


def exact(operation, arguments):
    values = [int(argument) for argument in arguments]
    if operation in {"pell", "tribonacci", "padovan"}:
        index = values[0]
        seeds, terms = {
            "pell": ([0, 1], lambda sequence: 2 * sequence[-1] + sequence[-2]),
            "tribonacci": ([0, 0, 1], lambda sequence: sum(sequence[-3:])),
            "padovan": ([1, 1, 1], lambda sequence: sequence[-2] + sequence[-3]),
        }[operation]
        sequence = list(seeds)
        while len(sequence) <= index:
            sequence.append(terms(sequence))
        return sequence[index]
    if operation == "yellowstone":
        index = values[0]
        sequence = [1, 2, 3]
        used = set(sequence)
        candidate = 1
        while len(sequence) <= index:
            while candidate in used or gcd(candidate, sequence[-2]) == 1 or gcd(candidate, sequence[-1]) != 1:
                candidate += 1
            sequence.append(candidate)
            used.add(candidate)
            candidate = 1
        return sequence[index]
    if operation == "kangaroo":
        term = 20
        for _ in range(1, values[0]):
            last = term % 10
            children = [
                term + 10 * last + first
                for first in range(1, 10)
                if str(term + 10 * last + first)[0] == str(first)
            ]
            if len(children) != 1:
                raise ValueError("kangaroo oracle reached a branch or dead end")
            term = children[0]
        return term
    if operation == "recaman":
        values_seen = {0}
        value = 0
        for index in range(1, values[0] + 1):
            backward = value - index
            value = backward if backward > 0 and backward not in values_seen else value + index
            values_seen.add(value)
        return value
    if operation == "stern":
        left, right = 0, 1
        for bit in bin(values[0])[2:]:
            if bit == "0":
                right = left + right
            else:
                left = left + right
        return left
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
