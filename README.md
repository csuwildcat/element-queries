## Element Queries

### How to use Element Queries

1. Add the main.js amd main.css files located in /src to your page 
2. Start having hyper-responsive, element query fun!

#### Example Markup:

```HTML
  <section media="query(small-width, (max-width: 300px) and (max-height: 300px))">

    <ul>
      <li>One</li>
      <li>Two</li>
      <li>Three</li>
    </ul>

  </section>
```

#### Example CSS:

```CSS
  section[matched-media~="small-width"] {
    font-size: 50%; /* small text for a wee lil element! */
  }
```