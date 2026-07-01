---
title: "Dependency Inversion Principle (DIP) in C#"
description: "The principle that ties SOLID together: depend on abstractions, not concretions, and let dependency injection do the wiring."
date: 2026-06-30T08:12:00+02:00
draft: false
tags: ["solid", "oop", "design-principles", "clean-code", "csharp"]
series: "solid-principles"
series_part: 6
series_title: "SOLID Principles in C#"
---

The **Dependency Inversion Principle** is the "D" in SOLID, and it is the one that ties the whole acronym together. Robert C. Martin states it in two parts:

> 1. High-level modules should not depend on low-level modules. Both should depend on **abstractions**.
> 2. Abstractions should not depend on details. Details should depend on **abstractions**.

The "inversion" in the name refers to flipping the usual flow of dependencies. Normally, your important business logic (high-level) reaches down and calls concrete helpers like a database or an SMTP client (low-level). DIP inverts that: both the business logic and the helpers depend on an abstraction in the middle, and the arrows now point *inward*, toward the policy that matters.

## The problem: high-level code chained to low-level details

Here is an order service that depends directly on concrete infrastructure:

```csharp
public class OrderService
{
    private readonly SqlOrderRepository _repository = new();
    private readonly SmtpEmailSender _emailSender = new();

    public void PlaceOrder(Order order)
    {
        _repository.Save(order);
        _emailSender.Send(order.CustomerEmail, "Order confirmed");
    }
}
```

The high-level policy, "when an order is placed, save it and notify the customer," is welded to two low-level decisions: it must be SQL, and it must be SMTP email. That coupling causes real pain:

- You cannot unit-test `PlaceOrder` without a live database and mail server.
- Switching to a NoSQL store or a push-notification service means editing `OrderService`.
- The most valuable code in the system, the business rule, is the least reusable, because it drags its infrastructure with it everywhere it goes.

## The fix: depend on abstractions

Introduce interfaces that express *what* the service needs, not *how* it is done, and let the concrete classes implement them:

```csharp
public interface IOrderRepository
{
    void Save(Order order);
}

public interface INotificationSender
{
    void Send(string recipient, string message);
}

public class SqlOrderRepository : IOrderRepository
{
    public void Save(Order order) { /* write to SQL */ }
}

public class SmtpEmailSender : INotificationSender
{
    public void Send(string recipient, string message) { /* send email */ }
}
```

Now the service depends only on the abstractions, which are injected through its constructor:

```csharp
public class OrderService
{
    private readonly IOrderRepository _repository;
    private readonly INotificationSender _notifier;

    public OrderService(IOrderRepository repository, INotificationSender notifier)
    {
        _repository = repository;
        _notifier = notifier;
    }

    public void PlaceOrder(Order order)
    {
        _repository.Save(order);
        _notifier.Send(order.CustomerEmail, "Order confirmed");
    }
}
```

`OrderService` no longer knows or cares whether storage is SQL or whether notifications go by email, SMS, or push. It depends on contracts. The concrete details now depend on those same contracts, which is the inversion the principle is named for.

## Who owns the abstraction matters

A subtle but important point: the interface conceptually belongs to the **high-level module**, not the low-level one. `IOrderRepository` exists to serve the needs of `OrderService`; the SQL implementation conforms to it. This is what keeps the policy stable while details come and go. If you ever find your abstraction shaped entirely around one concrete technology (an interface with a `SqlConnection` parameter, say), the inversion is only cosmetic.

## Dependency inversion vs. dependency injection

These two terms get used interchangeably, but they are not the same thing:

- **Dependency Inversion** is the *principle*: depend on abstractions.
- **Dependency Injection** is a *technique* for supplying those abstractions, usually by passing them into a constructor.

DI is the most common way to *achieve* DIP, but the principle is the goal and injection is just the mechanism. In .NET, the built-in container wires everything together at startup:

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.Services.AddScoped<IOrderRepository, SqlOrderRepository>();
builder.Services.AddScoped<INotificationSender, SmtpEmailSender>();
builder.Services.AddScoped<OrderService>();

var app = builder.Build();
```

This registration code is the single place that knows about concrete classes, the **composition root**. Everywhere else in the application works with interfaces. Want to swap email for SMS in production, or use an in-memory store in tests? Change one line here; the rest of the codebase does not move.

## The testing payoff

DIP is what makes the earlier examples in this series testable. With abstractions in place, a unit test supplies fakes instead of real infrastructure:

```csharp
public class FakeRepository : IOrderRepository
{
    public List<Order> Saved { get; } = new();
    public void Save(Order order) => Saved.Add(order);
}

public class FakeNotifier : INotificationSender
{
    public List<string> Messages { get; } = new();
    public void Send(string recipient, string message) => Messages.Add(message);
}

// The test runs with no database and no mail server.
[Fact]
public void PlaceOrder_SavesAndNotifies()
{
    var repository = new FakeRepository();
    var notifier = new FakeNotifier();
    var service = new OrderService(repository, notifier);

    service.PlaceOrder(new Order { CustomerEmail = "a@b.com" });

    Assert.Single(repository.Saved);
    Assert.Single(notifier.Messages);
}
```

No mocking framework required, no I/O, fast and deterministic. That is the practical reward of inverting your dependencies.

## The trap: abstracting everything

DIP does not mean every class needs an interface. Introducing an abstraction for a type that has exactly one implementation and no plausible reason to vary, a pure data model, a stable internal helper, adds indirection without buying flexibility. Reserve abstractions for the seams where change or substitution is realistic: external systems, infrastructure, and policy boundaries. A codebase where every class hides behind an `IThing` is just as hard to read as one with no abstractions at all.

## How SOLID fits together

With all five principles covered, the way they reinforce each other becomes clear:

- **SRP** gives each class one job, so the pieces are small enough to abstract cleanly.
- **OCP** lets you extend behavior by adding new implementations.
- **LSP** guarantees those implementations are safe substitutes.
- **ISP** keeps the abstractions small and focused.
- **DIP** points your dependencies at those abstractions, so high-level policy stays free of low-level detail.

They are not five separate rules so much as five views of the same goal: code that bends instead of breaks when requirements change.

## Takeaways

- High-level policy and low-level details should both depend on abstractions.
- The abstraction belongs to the consumer, not the implementation.
- Dependency injection is the technique; dependency inversion is the principle.
- Keep one composition root that knows the concrete types; abstract the seams, not everything.

That closes the series. If you started here, go back to the [introduction](/blog/solid-principles-introduction/) and read the five principles in order. The acronym is easy to memorize; the judgment about *when* to apply each one is what turns it into good design.
