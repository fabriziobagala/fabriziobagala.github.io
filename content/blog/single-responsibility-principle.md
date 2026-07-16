---
title: "Single Responsibility Principle (SRP) in C#"
description: "The most misunderstood letter in SOLID: what 'one reason to change' really means, with a before-and-after refactor."
date: 2026-06-26T19:42:00+02:00
draft: false
tags: ["solid", "oop", "design-principles", "clean-code", "csharp"]
series: "solid-principles"
series_part: 2
series_title: "SOLID Principles in C#"
---

The **Single Responsibility Principle** is the "S" in SOLID, and it is the one developers most often get wrong. The usual paraphrase, "a class should do only one thing," is too vague to be useful. What counts as "one thing"? A method does one thing. A whole microservice does one thing. The size of "one" is in the eye of the beholder.

Robert C. Martin's sharper definition is the one worth remembering:

> A class should have only **one reason to change**.

And the key follow-up: a reason to change is tied to a person or role who requests that change, what Martin calls an **actor**.

## What "one reason to change" means

Think about *who* asks for changes to a piece of code. If a single class can be modified for requests coming from different people with different concerns, it has more than one responsibility.

Consider a classic offender:

```csharp
public class Employee
{
    public string Name { get; init; } = "";
    public decimal BaseSalary { get; init; }

    // Requested by the finance/payroll team
    public decimal CalculatePay() => BaseSalary; // simplified

    // Requested by the HR team
    public string DescribeRole() => $"{Name} is a full-time employee.";

    // Requested by the database/infrastructure team
    public void Save() { /* write to SQL */ }
}
```

This class has three reasons to change, driven by three different actors:

- **Payroll** changes the pay calculation rules.
- **HR** changes how a role is described.
- **Infrastructure** changes how persistence works.

A change requested by payroll could accidentally break HR reporting, because the logic shares a file, a class, and possibly the same merge conflicts. That coupling is exactly what SRP warns against.

## The refactor

Split the responsibilities so each class answers to a single actor:

```csharp
public class Employee
{
    public string Name { get; init; } = "";
    public decimal BaseSalary { get; init; }
}

// Owned by payroll
public class PayCalculator
{
    public decimal CalculatePay(Employee employee) => employee.BaseSalary;
}

// Owned by HR
public class RoleDescriber
{
    public string Describe(Employee employee) => $"{employee.Name} is a full-time employee.";
}

// Owned by infrastructure
public class EmployeeRepository
{
    public void Save(Employee employee) { /* write to SQL */ }
}
```

Now `Employee` is a plain data holder, and each behavior lives where its actor can change it without disturbing the others. Payroll can rewrite `PayCalculator` freely; HR never even sees that file.

## A more realistic example

SRP is easiest to see in service classes that quietly grow extra jobs. Here is a reporting service that does too much:

```csharp
public class SalesReportService
{
    public void GenerateAndEmail(DateOnly monthStart, string recipient)
    {
        // 1. Fetch data
        var sales = Database.Query("SELECT * FROM Sales WHERE MonthStart = @monthStart", monthStart);

        // 2. Format as CSV
        var csv = string.Join("\n", sales.Select(s => $"{s.Id},{s.Amount}"));

        // 3. Send the email
        new EmailClient("smtp.example.com")
            .Send(recipient, "Monthly sales", csv);
    }
}
```

Three responsibilities, three reasons to change: the query, the format, and the delivery channel. Split them:

```csharp
public class SalesRepository
{
    public IReadOnlyList<Sale> GetForMonth(DateOnly monthStart) => throw new NotImplementedException();
}

public class CsvSalesFormatter
{
    public string Format(IEnumerable<Sale> sales) =>
        string.Join("\n", sales.Select(s => $"{s.Id},{s.Amount}"));
}

public class EmailSender
{
    public void Send(string recipient, string subject, string body) =>
        new EmailClient("smtp.example.com").Send(recipient, subject, body);
}

// The orchestrator wires them together, but owns no detail itself.
public class SalesReportService
{
    private readonly SalesRepository _repository;
    private readonly CsvSalesFormatter _formatter;
    private readonly EmailSender _sender;

    public SalesReportService(
        SalesRepository repository,
        CsvSalesFormatter formatter,
        EmailSender sender)
    {
        _repository = repository;
        _formatter = formatter;
        _sender = sender;
    }

    public void GenerateAndEmail(DateOnly monthStart, string recipient)
    {
        var sales = _repository.GetForMonth(monthStart);
        var csv = _formatter.Format(sales);
        _sender.Send(recipient, "Monthly sales", csv);
    }
}
```

Want PDF instead of CSV? Write a new formatter and swap it in the wiring. Want to push to a file share instead of email? Same move on the sender. The service still depends on concrete classes here, so the constructor wiring changes with the swap; later in the series, the Open/Closed and Dependency Inversion principles turn that swap into pure configuration behind interfaces. What SRP has already bought you is that the query, the format, and the delivery each live in exactly one place.

## The benefits you actually get

- **Testability**: you can unit-test `CsvSalesFormatter` without a database or an SMTP server.
- **Reusability**: `EmailSender` is now useful far beyond sales reports.
- **Lower blast radius**: a change to formatting cannot break the query.

## The trap: too much of a good thing

SRP is the easiest principle to over-apply. Taken to the extreme, every method becomes its own class, and you end up navigating fifteen files to follow one logical operation. That is not clean; it is fragmented.

Keep responsibilities together when they genuinely change together. A `Money` value object that knows how to add, subtract, and format itself is not violating SRP, because all of that is the single responsibility of "being money." The test is not "how many methods does it have"; it is "how many *unrelated actors* could ask for a change."

## Takeaways

- A class should have one reason to change, where a reason maps to an actor.
- Watch for classes that mix data access, business rules, and I/O.
- Split by actor, not by counting methods.
- Do not shatter cohesive logic just to chase the principle.

Next: the **[Open/Closed Principle](/blog/open-closed-principle/)**, which lets you add behavior without editing code that already works.
