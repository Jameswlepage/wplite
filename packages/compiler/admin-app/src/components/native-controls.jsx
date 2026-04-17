import React, { useCallback, useId, useMemo, useState } from 'react';
import { CarbonIcon } from '../lib/icons.jsx';

/**
 * Dark-chrome primitives for the document sidebar. These replace the
 * Gutenberg PanelBody / TextControl / SelectControl in our own surfaces
 * so we don't have to fight cascade to re-theme composite components.
 * Keep them minimal — no business logic, just the visuals.
 */

export function NativeSection({
  title,
  initialOpen = true,
  children,
  className = '',
  actions = null,
}) {
  const [open, setOpen] = useState(Boolean(initialOpen));
  const toggle = useCallback(() => setOpen((value) => !value), []);

  return (
    <section className={`ns-section${open ? ' is-open' : ''} ${className}`.trim()}>
      {title ? (
        <header className="ns-section__head">
          <button
            type="button"
            className="ns-section__title"
            aria-expanded={open}
            onClick={toggle}
          >
            <span className={`ns-section__chevron${open ? ' is-open' : ''}`} aria-hidden="true">
              <CarbonIcon name="ChevronRight" size={14} />
            </span>
            <span className="ns-section__label">{title}</span>
          </button>
          {actions ? <div className="ns-section__actions">{actions}</div> : null}
        </header>
      ) : null}
      {open ? (
        <div className="ns-section__body">
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function NativeFieldGrid({ children, cols = 2, className = '' }) {
  return (
    <div
      className={`ns-grid ns-grid--${cols} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function NativeField({
  label,
  help,
  htmlFor,
  children,
  className = '',
}) {
  return (
    <div className={`ns-field ${className}`.trim()}>
      {label ? (
        <label className="ns-field__label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      <div className="ns-field__control">{children}</div>
      {help ? <p className="ns-field__help">{help}</p> : null}
    </div>
  );
}

export function NativeInput({
  value,
  onChange,
  type = 'text',
  placeholder,
  id,
  disabled = false,
  autoComplete = 'off',
  ...rest
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <input
      {...rest}
      id={fieldId}
      type={type}
      value={value ?? ''}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      className={`ns-input${rest.className ? ` ${rest.className}` : ''}`}
      onChange={(event) => onChange?.(event.target.value, event)}
    />
  );
}

export function NativeTextarea({
  value,
  onChange,
  placeholder,
  rows = 4,
  id,
  disabled = false,
  ...rest
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;

  return (
    <textarea
      {...rest}
      id={fieldId}
      value={value ?? ''}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={`ns-input ns-input--textarea${rest.className ? ` ${rest.className}` : ''}`}
      onChange={(event) => onChange?.(event.target.value, event)}
    />
  );
}

export function NativeSelect({
  value,
  options = [],
  onChange,
  id,
  disabled = false,
  placeholder,
  ...rest
}) {
  const generatedId = useId();
  const fieldId = id || generatedId;
  const normalizedOptions = useMemo(() => (
    options.map((option) => ({
      value: String(option?.value ?? ''),
      label: option?.label ?? String(option?.value ?? ''),
      disabled: Boolean(option?.disabled),
    }))
  ), [options]);

  return (
    <div className="ns-select">
      <select
        {...rest}
        id={fieldId}
        value={String(value ?? '')}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.value, event)}
        className={`ns-select__native${rest.className ? ` ${rest.className}` : ''}`}
      >
        {placeholder !== undefined ? (
          <option value="" disabled>{placeholder}</option>
        ) : null}
        {normalizedOptions.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="ns-select__chevron ns-select__chevron--down" aria-hidden="true">
        <CarbonIcon name="ChevronRight" size={14} />
      </span>
    </div>
  );
}

export function NativeMetaList({ items, className = '' }) {
  const rows = items.filter(Boolean);
  if (!rows.length) return null;
  return (
    <dl className={`ns-meta ${className}`.trim()}>
      {rows.map((row, index) => (
        <div key={row?.id ?? index} className="ns-meta__row">
          <dt className="ns-meta__key">{row.label}</dt>
          <dd className="ns-meta__value">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function NativeHelpBlock({ children, tone = 'default', className = '' }) {
  return (
    <p className={`ns-help ns-help--${tone} ${className}`.trim()}>
      {children}
    </p>
  );
}
