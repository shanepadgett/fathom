defmodule Fathom.UI.Components do
  @moduledoc """
  Fathom controls as function components. They take assigns and slots only;
  they never read services or registries.

  Icons are Phosphor class names written in full, such as `"ph-gear"`, so the
  stylesheet build can find them in your source.
  """
  use Phoenix.Component

  @doc "A Phosphor icon, sized by font size."
  attr :name, :string, required: true
  attr :class, :any, default: "text-base"

  def icon(assigns) do
    ~H"""
    <span class={[@name, "shrink-0", @class]} aria-hidden="true"></span>
    """
  end

  @doc "A button. Variant and size resolve in the stylesheet."
  attr :variant, :string, default: "secondary", values: ~w(primary secondary quiet)
  attr :size, :string, default: "compact", values: ~w(compact small normal)
  attr :icon_only, :boolean, default: false
  attr :type, :string, default: "button"
  attr :class, :any, default: nil
  attr :rest, :global, include: ~w(disabled form name value)
  slot :inner_block, required: true

  def button(assigns) do
    ~H"""
    <button
      type={@type}
      class={["fathom-button", @class]}
      data-variant={@variant}
      data-size={@size}
      data-icon-only={@icon_only && ""}
      {@rest}
    >
      {render_slot(@inner_block)}
    </button>
    """
  end

  @doc "A quiet, icon-only button. Always labelled."
  attr :icon, :string, required: true
  attr :label, :string, required: true
  attr :toolbar, :boolean, default: false
  attr :class, :any, default: nil
  attr :rest, :global, include: ~w(disabled)

  def icon_button(assigns) do
    ~H"""
    <.button
      variant="quiet"
      size="small"
      icon_only
      class={@class}
      aria-label={@label}
      title={@label}
      {@rest}
    >
      <.icon name={@icon} class={if @toolbar, do: "text-xl", else: "text-base"} />
    </.button>
    """
  end

  @doc """
  A settings card. `padding="content"` pads all sides; `"rows"` pads only the
  sides so setting rows run edge to edge.
  """
  attr :padding, :string, default: "content", values: ~w(content rows)
  attr :class, :any, default: nil
  slot :inner_block, required: true

  def card(assigns) do
    ~H"""
    <section class={[
      "rounded-lg border border-line bg-surface",
      if(@padding == "rows", do: "px-5", else: "p-5"),
      @class
    ]}>
      {render_slot(@inner_block)}
    </section>
    """
  end

  @doc "A labelled field. The control inside supplies the matching id."
  attr :id, :string, required: true
  attr :label, :string, required: true
  attr :description, :string, default: nil
  attr :error, :string, default: nil
  slot :inner_block, required: true

  def field(assigns) do
    ~H"""
    <div class="grid gap-2">
      <label for={@id} class="type-dense">{@label}</label>
      {render_slot(@inner_block)}
      <p :if={@description} id={"#{@id}-description"} class="type-description">{@description}</p>
      <p :if={@error} id={"#{@id}-error"} role="alert" class="text-dense text-danger">{@error}</p>
    </div>
    """
  end

  @control "min-h-9 min-w-0 rounded-control border border-control-line bg-canvas px-3 py-2 text-dense text-ink disabled:opacity-50"

  @doc """
  A text-like input. Pass `field={@form[:name]}` for a form built with
  `to_form/2`, or `name`, `id`, and `value` directly.
  """
  attr :field, Phoenix.HTML.FormField, default: nil
  attr :type, :string, default: "text"
  attr :class, :any, default: nil

  attr :rest, :global,
    include: ~w(autocomplete disabled form id max min name pattern placeholder readonly
                required step value)

  def input(assigns) do
    assigns = assigns |> from_field() |> assign(:control, @control)

    ~H"""
    <input type={@type} class={[@control, @class]} {@rest} />
    """
  end

  @doc "A select. `options` takes `{label, value}` tuples. Accepts `field` like `input/1`."
  attr :field, Phoenix.HTML.FormField, default: nil
  attr :options, :list, required: true
  attr :value, :any, default: nil
  attr :prompt, :string, default: nil
  attr :prompt_disabled, :boolean, default: false
  attr :class, :any, default: nil
  attr :rest, :global, include: ~w(disabled form id name required)

  def select(assigns) do
    assigns = assigns |> from_field() |> assign(:control, @control)

    ~H"""
    <select class={[@control, @class]} {@rest}>
      <option :if={@prompt} value="" disabled={@prompt_disabled} selected={@value in [nil, ""]}>
        {@prompt}
      </option>
      {Phoenix.HTML.Form.options_for_select(@options, @value)}
    </select>
    """
  end

  @doc "A textarea. Accepts `field` like `input/1`."
  attr :field, Phoenix.HTML.FormField, default: nil
  attr :value, :string, default: nil
  attr :class, :any, default: nil
  attr :rest, :global, include: ~w(disabled form id name placeholder readonly required rows)

  def textarea(assigns) do
    assigns = from_field(assigns)

    ~H"""
    <textarea
      class={[
        "w-full min-w-0 resize-y rounded-control border border-control-line bg-canvas px-3 py-2 text-dense text-ink disabled:opacity-50",
        @class
      ]}
      {@rest}
    >{Phoenix.HTML.Form.normalize_value("textarea", @value)}</textarea>
    """
  end

  # A form field supplies id, name, and value; explicit attributes still win.
  defp from_field(%{field: %Phoenix.HTML.FormField{} = field} = assigns) do
    rest = Map.merge(%{id: field.id, name: field.name}, assigns.rest)

    case assigns do
      # select and textarea take value as an attribute.
      %{value: nil} -> assign(assigns, rest: rest, value: field.value)
      %{value: _} -> assign(assigns, :rest, rest)
      # input passes value through its global attributes.
      _ -> assign(assigns, :rest, Map.put_new(rest, :value, field.value))
    end
  end

  defp from_field(assigns), do: assigns

  @doc "A switch: one native checkbox, the knob drawn by `::after`."
  attr :label, :string, required: true
  attr :checked, :boolean, default: false
  attr :class, :any, default: nil
  attr :rest, :global, include: ~w(disabled form id name value)

  def switch(assigns) do
    ~H"""
    <input
      type="checkbox"
      role="switch"
      aria-label={@label}
      checked={@checked}
      class={[
        "relative h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full border border-control-line bg-line checked:border-action checked:bg-action disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:h-3.5 after:w-3.5 after:rounded-full after:bg-muted after:content-[''] checked:after:translate-x-4 checked:after:bg-on-action",
        @class
      ]}
      {@rest}
    />
    """
  end

  @doc """
  A browser-local appearance control owned by the harness page: the theme
  select or the reduce-motion switch. The page keeps its value.
  """
  attr :preference, :string, required: true, values: ~w(theme motion)
  attr :class, :any, default: nil

  def appearance_control(%{preference: "theme"} = assigns) do
    assigns = assign(assigns, :control, @control)

    ~H"""
    <select
      id="fathom-appearance-theme"
      phx-hook="FathomAppearance"
      phx-update="ignore"
      data-preference="theme"
      aria-label="Theme"
      class={[@control, @class]}
    >
      <option value="system">System</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
    """
  end

  def appearance_control(%{preference: "motion"} = assigns) do
    ~H"""
    <.switch
      id="fathom-appearance-motion"
      label="Reduce motion"
      phx-hook="FathomAppearance"
      phx-update="ignore"
      data-preference="motion"
      class={@class}
    />
    """
  end

  @doc "A setting row: label and description left, control right."
  attr :label, :string, required: true
  attr :description, :string, required: true
  slot :inner_block, required: true

  def setting_row(assigns) do
    ~H"""
    <label class="flex min-h-20 items-center justify-between gap-6 border-b border-line py-4 last:border-b-0">
      <span>
        <span class="block type-label">{@label}</span>
        <span class="mt-1 block type-description">{@description}</span>
      </span>
      {render_slot(@inner_block)}
    </label>
    """
  end

  @doc "The frame every settings section renders inside."
  attr :title, :string, default: nil
  attr :description, :string, default: nil
  slot :inner_block, required: true

  def settings_section(assigns) do
    ~H"""
    <div class="mx-auto w-full max-w-3xl px-10 py-8">
      <header :if={@title} class="mb-6">
        <h1 class="type-title">{@title}</h1>
        <p :if={@description} class="type-description mt-3">{@description}</p>
      </header>
      {render_slot(@inner_block)}
    </div>
    """
  end

  attr :error, :boolean, default: false
  slot :inner_block, required: true

  def inline_notice(assigns) do
    ~H"""
    <p
      role={if @error, do: "alert", else: "status"}
      class={["break-words type-dense", if(@error, do: "text-danger", else: "text-muted")]}
    >
      {render_slot(@inner_block)}
    </p>
    """
  end

  slot :inner_block, required: true

  def empty_state(assigns) do
    ~H"""
    <p class="px-3 py-6 text-sm text-muted">{render_slot(@inner_block)}</p>
    """
  end

  @doc "A navigation row. `current` marks the active row."
  attr :label, :string, required: true
  attr :icon, :string, default: nil
  attr :current, :boolean, default: false
  attr :class, :any, default: nil
  attr :rest, :global
  slot :trailing

  def nav_item(assigns) do
    ~H"""
    <button
      type="button"
      aria-current={@current && "page"}
      class={[
        "flex min-h-12 w-full items-center gap-3 border-b border-line px-4 py-3 text-left type-dense text-muted hover:bg-surface hover:text-ink aria-[current=page]:bg-action/10 aria-[current=page]:font-medium aria-[current=page]:text-action",
        @class
      ]}
      {@rest}
    >
      <.icon :if={@icon} name={@icon} />
      <span class="flex-1">{@label}</span>
      {render_slot(@trailing)}
    </button>
    """
  end

  @doc "Labelled dots announce state; unlabelled dots stay hidden from assistive tech."
  attr :tone, :string, default: "neutral", values: ~w(neutral action success warning danger)
  attr :label, :string, default: nil
  attr :small, :boolean, default: false

  def status_dot(assigns) do
    ~H"""
    <span
      class={[
        "shrink-0 rounded-full",
        if(@small, do: "h-1.5 w-1.5", else: "h-2 w-2"),
        dot(@tone)
      ]}
      role={@label && "img"}
      aria-label={@label}
      aria-hidden={!@label && "true"}
    ></span>
    """
  end

  defp dot("neutral"), do: "bg-muted"
  defp dot("action"), do: "bg-action"
  defp dot("success"), do: "bg-success"
  defp dot("warning"), do: "bg-warning"
  defp dot("danger"), do: "bg-danger"

  @doc "A tab strip. Clicking sends `on_select` with `%{\"id\" => id}`."
  attr :items, :list, required: true, doc: "`{id, label}` tuples"
  attr :selected, :string, default: nil
  attr :label, :string, required: true
  attr :on_select, :string, required: true
  attr :target, :any, default: nil

  def tabs(assigns) do
    ~H"""
    <div class="flex h-9 shrink-0 border-b border-line text-sm" role="group" aria-label={@label}>
      <button
        :for={{id, label} <- @items}
        type="button"
        aria-pressed={to_string(id == @selected)}
        phx-click={@on_select}
        phx-value-id={id}
        phx-target={@target}
        class={[
          "flex flex-1 items-center justify-center border-t-2",
          if(id == @selected,
            do: "border-action bg-canvas text-ink",
            else: "border-transparent text-muted hover:text-ink"
          )
        ]}
      >
        {label}
      </button>
    </div>
    """
  end

  @doc """
  A dialog rendered while `show` is true. Escape, the backdrop, and the close
  button send `on_close`.
  """
  attr :id, :string, required: true
  attr :title, :string, required: true
  attr :show, :boolean, default: false
  attr :on_close, :string, required: true
  attr :target, :any, default: nil
  slot :inner_block, required: true

  def dialog(assigns) do
    ~H"""
    <div :if={@show} id={@id} class="fixed inset-0 z-50">
      <div class="absolute inset-0 overlay-glass" phx-click={@on_close} phx-target={@target}></div>
      <dialog
        open
        class="fathom-dialog"
        aria-labelledby={"#{@id}-title"}
        phx-window-keydown={@on_close}
        phx-key="Escape"
        phx-target={@target}
      >
        <div class="mb-4 flex items-center justify-between gap-4">
          <h2 id={"#{@id}-title"} class="type-title tracking-tight">{@title}</h2>
          <.icon_button icon="ph-x" label="Close dialog" phx-click={@on_close} phx-target={@target} />
        </div>
        {render_slot(@inner_block)}
      </dialog>
    </div>
    """
  end
end
