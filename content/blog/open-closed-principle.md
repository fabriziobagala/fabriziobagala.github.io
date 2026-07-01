---
title: "Open/Closed Principle (OCP) in C#"
description: "How to add new behavior without touching code that already works, using polymorphism instead of growing switch statements."
date: 2026-06-27T22:18:00+02:00
draft: false
tags: ["solid", "oop", "design-principles", "clean-code", "csharp"]
series: "solid-principles"
series_part: 3
series_title: "SOLID Principles in C#"
---

The **Open/Closed Principle** is the "O" in SOLID, and its definition sounds like a contradiction until you unpack it:

> Software entities should be **open for extension, but closed for modification**.

The phrasing goes back to Bertrand Meyer in 1988; the modern, polymorphism-based reading popularized by Robert C. Martin is the one we will use here.

In plain terms: you should be able to add new behavior to a system without editing the existing, tested, working code. You extend by adding new code, not by rewriting old code.

The reason this matters is risk. Every time you modify a class that already works, you risk breaking it, and you force a re-test of everything that depends on it. If you can add features purely by adding new classes, the old ones stay stable and trusted.

## The smell: a growing switch statement

The classic OCP violation is a method that branches on a type and grows every time a new case appears:

```csharp
public class ShippingCalculator
{
    public decimal Calculate(Order order)
    {
        switch (order.ShippingMethod)
        {
            case "Standard":
                return order.Weight * 1.0m;
            case "Express":
                return order.Weight * 2.5m;
            case "Overnight":
                return order.Weight * 5.0m + 10m;
            default:
                throw new ArgumentException("Unknown shipping method.");
        }
    }
}
```

Every new shipping option, drone delivery, international freight, pickup point, forces you to crack open this class and add another `case`. The class is *not closed* for modification. Worse, all the unrelated shipping rules pile up in one method, and a typo in the express rule risks the standard rule.

## The fix: program to an abstraction

Define an abstraction for "a way to calculate shipping," then let each method be its own class:

```csharp
public interface IShippingStrategy
{
    decimal Calculate(Order order);
}

public class StandardShipping : IShippingStrategy
{
    public decimal Calculate(Order order) => order.Weight * 1.0m;
}

public class ExpressShipping : IShippingStrategy
{
    public decimal Calculate(Order order) => order.Weight * 2.5m;
}

public class OvernightShipping : IShippingStrategy
{
    public decimal Calculate(Order order) => order.Weight * 5.0m + 10m;
}
```

The calculator now depends on the abstraction and never changes:

```csharp
public class ShippingCalculator
{
    public decimal Calculate(Order order, IShippingStrategy strategy) =>
        strategy.Calculate(order);
}
```

Adding **drone delivery** is now purely additive:

```csharp
public class DroneShipping : IShippingStrategy
{
    public decimal Calculate(Order order) => order.Weight * 3.0m + 25m;
}
```

You wrote a new file. You touched nothing that already worked. `ShippingCalculator`, `StandardShipping`, and the rest stay exactly as they were, fully tested and untouched. That is the Open/Closed Principle in action.

## Wiring it up

In a real application, you would resolve the right strategy from a registry or your dependency-injection container instead of a switch. Even a simple dictionary keeps the selection logic in one obvious place:

```csharp
public class ShippingStrategyResolver
{
    private readonly Dictionary<string, IShippingStrategy> _strategies = new()
    {
        ["Standard"] = new StandardShipping(),
        ["Express"] = new ExpressShipping(),
        ["Overnight"] = new OvernightShipping(),
        ["Drone"] = new DroneShipping(),
    };

    public IShippingStrategy Resolve(string method) =>
        _strategies.TryGetValue(method, out var strategy)
            ? strategy
            : throw new ArgumentException($"Unknown shipping method: {method}");
}
```

You might notice the dictionary still changes when a new method appears. That is fine: it is a single, declarative line of registration, not scattered business logic. The *rules* stay closed for modification; only the *composition* is open.

## OCP beyond strategies

The pattern generalizes. Any time you find yourself writing `if (type == X) ... else if (type == Y)` around behavior, OCP suggests replacing the conditional with polymorphism:

- A `switch` on a discount type becomes a set of `IDiscountRule` classes.
- A chain of `if` checks on a notification channel becomes `INotificationChannel` implementations.
- Validation rules become a list of `IValidationRule` objects you can extend.

## The trap: speculative abstraction

OCP has a dark side: it tempts you to build extension points for changes that never come. Every interface and strategy class is a cost in indirection and reading effort. If you have exactly one shipping method and no plan for more, a plain method is the right call.

The pragmatic rule is the **rule of three**. The first time you need a variation, a simple conditional is fine. The second time, you tolerate the duplication. When a third variation shows up and the conditional is clearly going to keep growing, that is your signal to introduce the abstraction. Refactoring toward OCP when the pressure is real beats guessing up front.

## Takeaways

- Open for extension, closed for modification: add new code, do not edit working code.
- Replace growing `switch`/`if` chains over behavior with polymorphism.
- A small registration point that changes is acceptable; scattered business rules are not.
- Do not abstract speculatively; introduce the seam when a real second variation arrives.

Next: the **Liskov Substitution Principle**, which makes sure your subclasses can actually stand in for their base types.
