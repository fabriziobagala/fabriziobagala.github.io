---
title: "Liskov Substitution Principle (LSP) in C#"
description: "Why a square should not inherit from a rectangle, and how to keep subtypes honest about the contracts they inherit."
date: 2026-06-28T20:33:00+02:00
draft: false
tags: ["solid", "oop", "design-principles", "clean-code", "csharp"]
series: "solid-principles"
series_part: 4
series_title: "SOLID Principles in C#"
---

The **Liskov Substitution Principle** is the "L" in SOLID, named after computer scientist Barbara Liskov. It is the most formal of the five, but the idea behind it is simple:

> If `S` is a subtype of `T`, then objects of type `T` can be replaced with objects of type `S` **without breaking the program**.

In other words, any code that works with a base type must keep working when you hand it a derived type. A subclass must honor the promises of its parent. If a caller has to ask "which concrete type is this really?" before using it safely, LSP has been violated.

This principle is what makes the Open/Closed Principle trustworthy. Polymorphism only works if substitutes genuinely behave like what they replace.

## The classic violation: square is-a rectangle

Mathematically, a square is a rectangle. In code, modeling it that way blows up:

```csharp
public class Rectangle
{
    public virtual int Width { get; set; }
    public virtual int Height { get; set; }
    public int Area => Width * Height;
}

public class Square : Rectangle
{
    public override int Width
    {
        set { base.Width = value; base.Height = value; }
    }

    public override int Height
    {
        set { base.Width = value; base.Height = value; }
    }
}
```

The `Square` keeps its sides equal by overriding the setters. Reasonable, until a caller written against `Rectangle` does something every rectangle should allow:

```csharp
public static void Stretch(Rectangle rectangle)
{
    rectangle.Width = 5;
    rectangle.Height = 4;

    // Any honest rectangle now has an area of 20.
    Debug.Assert(rectangle.Area == 20);
}
```

Pass a `Square`, and setting `Height = 4` also forces `Width = 4`, so the area is 16, not 20. The assertion fails. The `Stretch` method did nothing wrong; it relied on the contract that width and height are independent, and `Square` broke that contract. `Square` is *not* substitutable for `Rectangle`.

The lesson is that **inheritance models behavior, not real-world taxonomy**. "Is-a" in English does not guarantee "is-substitutable-for" in code.

## A better model

If the shapes do not share substitutable behavior, do not force an inheritance relationship. Make them siblings under an abstraction that only promises what they can both deliver:

```csharp
public interface IShape
{
    int Area { get; }
}

public class Rectangle : IShape
{
    public int Width { get; init; }
    public int Height { get; init; }
    public int Area => Width * Height;
}

public class Square : IShape
{
    public int Side { get; init; }
    public int Area => Side * Side;
}
```

Now nobody can call `square.Width = 5` and expect rectangle behavior, because that member does not exist. Both types honestly implement `Area`, and code written against `IShape` works with either. Notice the use of `init` instead of `set`: making the shapes immutable also sidesteps the entire mutable-setter trap.

## A subtler, real-world violation

The square problem is famous but feels academic. Here is one you actually meet. Suppose a base contract promises that every repository can both read and write:

```csharp
public abstract class Repository<T>
{
    public abstract T GetById(int id);
    public abstract void Save(T entity);
}

public class ReadOnlyReportRepository : Repository<Report>
{
    private readonly ReportStore _store = new();

    public override Report GetById(int id) => _store.Load(id);

    public override void Save(Report entity) =>
        throw new NotSupportedException("Reports are read-only.");
}
```

This compiles, but it is a textbook LSP violation. Any code that accepts a `Repository<Report>` and calls `Save` will blow up at runtime for this subclass. The subtype weakened a promise the base type made.

The fix is to not promise more than every subtype can keep. Split the capability so types only advertise what they truly support:

```csharp
public interface IReadRepository<T>
{
    T GetById(int id);
}

public interface IWriteRepository<T>
{
    void Save(T entity);
}

public class ReportRepository : IReadRepository<Report>
{
    private readonly ReportStore _store = new();

    public Report GetById(int id) => _store.Load(id);
}
```

Now `ReportRepository` simply does not implement the write side, so no caller can ask it to do the impossible. (This naturally leads into the Interface Segregation Principle, the next article.)

## The rules behind the principle

LSP is often expressed as a set of contract rules a subtype must follow:

- **Preconditions cannot be strengthened**: a subtype must not demand more of its inputs than the base type did. If the base accepts any string, the subtype cannot reject empty strings.
- **Postconditions cannot be weakened**: a subtype must deliver at least what the base promised. If the base guarantees a non-null result, so must the subtype.
- **Invariants must be preserved**: rules that always hold for the base must still hold for the subtype.
- **No new exceptions**: a subtype should not throw exceptions the caller of the base type would not expect, like the `NotSupportedException` above.
- **Signatures stay variance-safe**: a subtype may return more specific results, never demand more specific inputs. C# is stricter than the theory here: override parameters must match the base exactly, and only return types can narrow (covariant returns, since C# 9), so the compiler keeps you honest.
- **The history constraint holds**: a subtype must not allow state changes the base type forbids. Deriving a mutable type from an immutable one is the classic breach, since callers of the base assume the object never changes after creation.

If you keep these in mind, you will catch most violations before they reach production.

## Takeaways

- A subtype must be usable anywhere its base type is, with no surprises.
- "Is-a" in language does not imply "is-substitutable" in code; model behavior, not taxonomy.
- Watch for overrides that throw `NotSupportedException` or that quietly change expected results.
- Do not strengthen preconditions, weaken postconditions, or break invariants in subtypes.

Next: the **[Interface Segregation Principle](/blog/interface-segregation-principle/)**, which keeps your abstractions small enough that nobody is forced to implement methods they do not need.
