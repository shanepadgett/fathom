defmodule FathomWeb.Layouts do
  @moduledoc """
  The root layout. Plugin views render inside the renderer root; they bring
  no layout of their own.
  """
  use FathomWeb, :html

  embed_templates "layouts/*"
end
