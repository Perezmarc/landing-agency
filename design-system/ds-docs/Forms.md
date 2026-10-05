---
category: Components
---

# Form controls

`TextInput`, `Select`, `Switch` and `SegmentedControl`. Every text field in the
product goes through `TextInput` — a shared className on a raw `<input>` is not
enough, because two of them written in different files drift apart on the next
change.

## TextInput

```jsx
<TextInput value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
<TextInput lg type="email" placeholder="you@example.com" />   {/* 44px — sign-in screens */}
<TextInput error aria-describedby="email-err" />              {/* also sets aria-invalid */}
<TextInput multiline rows={4} placeholder="Notes" />          {/* a <textarea>, same look */}
```

`error` applies the error border **and** `aria-invalid`, so the state is not
carried by colour alone.

## Select

A native `<select>` with the arrow drawn in CSS, so it looks the same on macOS,
Windows and Android. Pass `<option>`s as children.

```jsx
<Select value={plan} onChange={e => setPlan(e.target.value)}>
  <option value="free">Free</option>
  <option value="pro">Pro</option>
</Select>
```

## Switch

A real `<button role="switch">` with `aria-checked` — keyboard-operable and
announced correctly. `onChange` receives the **next** value.

```jsx
<Switch checked={on} onChange={setOn} aria-label="Email updates" />
<Switch size="sm" checked={on} onChange={setOn} aria-label="Compact" />
```

It has no visible text, so always give it an `aria-label` or wire `id` to a
`<label>`.

## SegmentedControl

For two to four mutually exclusive options that should all be visible at once.
Use a `Select` instead when the list is long, and this instead of styled radio
buttons.

```jsx
<SegmentedControl
  label="Billing period"
  tabs={[{ value: 'month', label: 'Monthly' }, { value: 'year', label: 'Yearly' }]}
  value={interval}
  onChange={setInterval}
/>
```

## Field layout

`.ui-field` is the label + control + hint/error stack; `.ui-field-row` is a
two-up row that collapses to one column when the columns get narrow.

```jsx
<div className="ui-field">
  <label htmlFor="name">Name</label>
  <TextInput id="name" value={name} onChange={…} />
  <span className="ui-field-hint">Shown to your teammates.</span>
</div>
```

Always tie the label to the control with `htmlFor` + `id`. A visually adjacent
label is not an accessible one.
