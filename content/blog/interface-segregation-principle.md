---
title: "Interface Segregation Principle (ISP) in C#"
description: "Why fat interfaces hurt, and how splitting them into focused contracts stops clients from depending on methods they never call."
date: 2026-06-29T21:50:00+02:00
draft: false
tags: ["solid", "oop", "design-principles", "clean-code", "csharp"]
series: "solid-principles"
series_part: 5
series_title: "SOLID Principles in C#"
---

The **Interface Segregation Principle** is the "I" in SOLID. Its definition is short:

> No client should be forced to depend on methods it does not use.

Put another way: prefer several small, focused interfaces over one large, general-purpose one. A "fat" interface, one that bundles many unrelated operations, forces every implementer to deal with methods it does not care about, and forces every consumer to depend on capabilities it never touches.

ISP is the natural partner of the Liskov Substitution Principle. A common reason subtypes throw `NotSupportedException` is that they were handed an interface too big for them. Shrink the interface, and the problem disappears.

## The smell: the fat interface

Imagine a printer abstraction designed for a top-of-the-line office machine:

```csharp
public interface IMultiFunctionDevice
{
    void Print(Document document);
    void Scan(Document document);
    void Fax(Document document);
    void Staple(Document document);
}
```

This is fine for a device that does everything. The trouble starts when a simple, print-only printer must implement the same interface:

```csharp
public class BasicPrinter : IMultiFunctionDevice
{
    public void Print(Document document) { /* works */ }

    public void Scan(Document document) =>
        throw new NotSupportedException();

    public void Fax(Document document) =>
        throw new NotSupportedException();

    public void Staple(Document document) =>
        throw new NotSupportedException();
}
```

Three of the four methods are lies. `BasicPrinter` is forced to depend on, and fake, behavior it does not have. Any code holding an `IMultiFunctionDevice` might call `Fax` and crash at runtime. The interface promised more than this implementer could keep, which also violates Liskov.

## The fix: split by capability

Break the fat interface into focused contracts, one per capability:

```csharp
public interface IPrinter
{
    void Print(Document document);
}

public interface IScanner
{
    void Scan(Document document);
}

public interface IFax
{
    void Fax(Document document);
}

public interface IStapler
{
    void Staple(Document document);
}
```

Now each device implements exactly what it can actually do:

```csharp
public class BasicPrinter : IPrinter
{
    public void Print(Document document) { /* works, and that is all it claims */ }
}

public class OfficeAllInOne : IPrinter, IScanner, IFax, IStapler
{
    public void Print(Document document) { /* ... */ }
    public void Scan(Document document) { /* ... */ }
    public void Fax(Document document) { /* ... */ }
    public void Staple(Document document) { /* ... */ }
}
```

The all-in-one device composes several small interfaces; the basic printer implements just one. No more fake methods, no more runtime surprises.

## Consumers get cleaner too

ISP does not only help implementers; it sharpens the code that *uses* these types. A method should ask only for the capability it needs:

```csharp
// Bad: demands the whole device just to print.
public void PrintInvoice(IMultiFunctionDevice device, Document invoice) =>
    device.Print(invoice);

// Good: depends only on the ability to print.
public void PrintInvoice(IPrinter printer, Document invoice) =>
    printer.Print(invoice);
```

The second version is honest about its needs. It can accept a `BasicPrinter`, an `OfficeAllInOne`, or a test double that only implements `IPrinter`. The dependency is as narrow as the job requires, which makes the code easier to reuse and to test.

## A practical heuristic

You do not need to split every interface into single-method pieces. The right granularity is **per role**, that is, by the way a group of methods is used together. Ask: do these methods always get implemented and consumed as a set?

- A `Stream` with `Read` and `Write` is the BCL's deliberate trade-off, not a counterexample: plenty of implementations throw `NotSupportedException` for the parts they cannot honor (a read-only stream's `Write`, a `NetworkStream`'s `Seek`), which is exactly the fat-interface signal below, so .NET compensates with runtime capability flags (`CanRead`/`CanWrite`) and dedicated reader/writer types.
- A service interface with twenty methods spanning user management, billing, and reporting almost certainly serves three different clients and should be three interfaces.

The signal that an interface is too fat is concrete: implementers that throw "not supported," or consumers that use only one or two of its many methods.

## ISP and the C# toolbox

C# makes segregation cheap. A class can implement any number of interfaces, so composing capabilities costs nothing:

```csharp
public class ScanAndPrintKiosk : IPrinter, IScanner
{
    public void Print(Document document) { /* ... */ }
    public void Scan(Document document) { /* ... */ }
}
```

And consumers can require multiple capabilities at once with a generic constraint when they genuinely need both:

```csharp
public void Photocopy<T>(T device, Document doc) where T : IScanner, IPrinter
{
    device.Scan(doc);
    device.Print(doc);
}
```

The method states precisely what it needs, no more.

## Takeaways

- No client should depend on methods it does not use.
- Fat interfaces force implementers to fake methods and consumers to over-depend.
- Split interfaces by role, where a role is a cohesive set of methods used together.
- The warning signs are `NotSupportedException` in implementations and consumers that touch only a fraction of an interface.

Next: the final principle, the **[Dependency Inversion Principle](/blog/dependency-inversion-principle/)**, which flips your dependencies so high-level policy no longer hangs off low-level details.
