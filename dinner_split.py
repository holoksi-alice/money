#!/usr/bin/env python3
"""Simple dinner payment tracker for two people.

Usage:
  python dinner_split.py

The program lets you enter multiple dinner expenses, each with payer (me/girlfriend)
and amount. At the end it prints totals and how much one person should pay the other
so both have paid equally.
"""

from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


ME = "me"
GIRLFRIEND = "girlfriend"


def money(value: Decimal) -> str:
    return f"${value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)}"


def parse_amount(raw: str) -> Decimal:
    try:
        amount = Decimal(raw.strip())
    except InvalidOperation as exc:
        raise ValueError("Please enter a valid number.") from exc

    if amount <= 0:
        raise ValueError("Amount must be greater than 0.")

    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def get_payer(raw: str) -> str:
    payer = raw.strip().lower()
    if payer in {"g", "gf", "girl", "girlfriend"}:
        return GIRLFRIEND
    if payer in {"m", "me", "i"}:
        return ME
    raise ValueError("Payer must be 'me' or 'girlfriend'.")


def settle_amount(me_total: Decimal, girlfriend_total: Decimal) -> tuple[str, Decimal]:
    total = me_total + girlfriend_total
    half = (total / 2).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    if me_total > half:
        return (GIRLFRIEND, (me_total - half).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    if girlfriend_total > half:
        return (ME, (girlfriend_total - half).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    return ("none", Decimal("0.00"))


def main() -> None:
    print("Dinner Payment Tracker")
    print("Enter each dinner bill and who paid it.")
    print("Type 'done' when finished.\n")

    me_total = Decimal("0.00")
    girlfriend_total = Decimal("0.00")
    item_count = 0

    while True:
        payer_raw = input("Who paid? (me/girlfriend or done): ").strip()
        if payer_raw.lower() == "done":
            break

        try:
            payer = get_payer(payer_raw)
        except ValueError as err:
            print(f"Error: {err}\n")
            continue

        amount_raw = input("Amount: ").strip()
        try:
            amount = parse_amount(amount_raw)
        except ValueError as err:
            print(f"Error: {err}\n")
            continue

        if payer == ME:
            me_total += amount
        else:
            girlfriend_total += amount

        item_count += 1
        print(f"Recorded: {payer} paid {money(amount)}\n")

    print("\n--- Summary ---")
    print(f"Entries: {item_count}")
    print(f"Me paid: {money(me_total)}")
    print(f"Girlfriend paid: {money(girlfriend_total)}")
    print(f"Total dinner spend: {money(me_total + girlfriend_total)}")

    who_pays, amount = settle_amount(me_total, girlfriend_total)
    if who_pays == "none":
        print("You are already even. No one owes anything.")
    elif who_pays == ME:
        print(f"To split equally, me should pay girlfriend {money(amount)}")
    else:
        print(f"To split equally, girlfriend should pay me {money(amount)}")


if __name__ == "__main__":
    main()
