import { useState }  from 'react';
import { ItemList }  from '../../components/ItemList';
import { CodeBlock } from '../components/CodeBlock';

type Product = {
    name: string;
    description : string;
    price: string
};

export function ItemListPage() {
    const [tags1   , setTags1   ] = useState<string[]>(['fever', 'cough']);
    const [tags2   , setTags2   ] = useState<string[]>(['fever', 'cough']);
    const [pairs1  , setPairs1  ] = useState<[string, string][]>([['name 1', 'value 1']])
    const [pairs2  , setPairs2  ] = useState<{name: string, value: string}[]>([{ name: 'name 1', value: 'value 1' }])
    const [products, setProducts] = useState<Product[]>([
        { name: 'Product 1', description: 'Description for Product 1', price: '$100' },
        { name: 'Product 2', description: 'Description for Product 2', price: '$120' },
    ]);

    return (
        <section style={{ maxWidth: '38rem' }}>
            <header className="text-sky-500 uppercase mb-8">ItemList</header>
            <p className="mb-4 cp-text-txt-5">
                A generic editor for a list of anything. It draws each item with a remove
                button beside it and an add button underneath; what an item <em>looks</em>{' '}
                like is entirely <code>renderItem</code>&apos;s business, and what a new one
                starts as is <code>getNewItem</code>&apos;s.
            </p>
            <p className="mb-4 cp-text-txt-5">
                It holds no state. Adding and removing are reported through{' '}
                <code>onChange</code>, and editing a field is not reported at all — the
                editor you render owns that, so it updates the list itself.
            </p>
            <h5 className="mb-2">onChange has to copy</h5>
            <p className="mb-4 cp-text-txt-5">
                <strong className='text-amber-700'>This is the one thing to get right.</strong> Removing an item{' '}
                <code>splice</code>s the array you passed in and hands that
                <em> same array</em> back:
            </p>
            <CodeBlock language="tsx">{`onClick={() => { items.splice(i, 1); onChange(items); }}`}</CodeBlock>
            <p className="mb-4 cp-text-txt-5">
                So <code>onChange={'{setItems}'}</code> — the obvious thing to write —{' '}
                <strong>silently does nothing</strong> when an item is removed. React compares
                the next state to the current one with <code>Object.is</code>, sees the same
                array reference, and skips the render. The item is gone from the data and
                still on the screen.
            </p>
            <p className="mb-4 cp-text-txt-5">
                Every example on this page therefore copies:
            </p>
            <CodeBlock language="tsx">{`onChange={list => setItems([...list])}`}</CodeBlock>
            <p className="mb-4 cp-text-txt-5">
                Adding is unaffected — that path builds a new array. Only removal is caught by
                this, which is what makes it easy to miss.
            </p>

            <article className="mb-12 mt-12">
                <h3 className="mb-2">Basic String List</h3>
                <p className="mb-4 cp-text-txt-5">
                    When <code>params</code> is a list of strings, it renders a
                    simple editable list.
                </p>
                <CodeBlock language="tsx">{`<ItemList params={tags} onChange={list => setTags([...list])} />`}</CodeBlock>
                <div className='mb-4'>
                    <ItemList params={tags1} onChange={list => setTags1([...list])} />
                </div>
                <CodeBlock language="ts">{`// Current value:\n${JSON.stringify(tags1, null, 2)}`}</CodeBlock>
            </article>

            <article className="mb-12">
                <h3 className="mb-2 mt-5">Allow add/remove</h3>
                <p className="mb-4 cp-text-txt-5">
                    When <code>getNewItem</code> prop is provided, rows can be
                    removed and new ones can be added.
                </p>
                <CodeBlock language="tsx">{`<ItemList
    params={tags}
    getNewItem={() => ''}
    onChange={list => setTags([...list])}
/>`}</CodeBlock>
                <div className='mb-4'>
                    <ItemList params={tags2} getNewItem={() => ''} onChange={list => setTags2([...list])} />
                </div>
                <CodeBlock language="ts">{`// Current value:\n${JSON.stringify(tags2, null, 2)}`}</CodeBlock>
            </article>

            <article className="mb-12 mt-12">
                <h3 className="mb-2">Name-value Pairs</h3>
                <p className="mb-4 cp-text-txt-5">
                    When <code>params</code> is a list of <code>[string, string]</code> arrays,
                    or a list of <code>{'{'} name, value {'}'}</code> objects, it renders as
                    name/value pairs list.
                </p>
                <CodeBlock language="tsx">{`<ItemList
    params={pairs}
    onChange={list => setTags([...list])}
    getNewItem={() => ['', '']}
/>`}</CodeBlock>
                <div className='mb-4'>
                    <ItemList params={pairs1} onChange={list => setPairs1([...list])} getNewItem={() => ['', '']} />
                </div>
                <CodeBlock language="ts">{`// Current value:\n${JSON.stringify(pairs1, null, 2)}`}</CodeBlock>

                <br />
                <br />
                <CodeBlock language="tsx">{`<ItemList
    params={pairs}
    onChange={list => setTags([...list])}
    getNewItem={() => ({ name: 'New Name', value: 'New Value' })}
/>`}</CodeBlock>
                <div className='mb-4'>
                    <ItemList
                        params={pairs2}
                        onChange={list => setPairs2([...list])}
                        getNewItem={() => ({ name: 'New Name', value: 'New Value' })}
                    />
                </div>
                <CodeBlock language="ts">{`// Current value:\n${JSON.stringify(pairs2, null, 2)}`}</CodeBlock>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Items of any shape</h3>
                <p className="mb-4 cp-text-txt-5">
                    <code>renderItem</code> gets the item and its index and is expected to return
                    a <code>ReactNode</code>. You can use this to customize the contents written
                    into each row.
                </p>
                <p>
                    This also demonstrates how to use the <code>label</code> and <code>emptyMsg</code> props
                    to customize the text labels.
                </p>
                <CodeBlock language="tsx">{`<ItemList
    params={products}
    label='Product'
    onChange={list => setProducts([...list])}
    emptyMsg="No products available"
    renderItem={(product, i) => (
        <div className="cp-param-list-col py-2">
            <h6>{product.name}</h6>
            <p className='cp-text-sm cp-text-txt-7'>
                {product.description}
            </p>
            <div className='cp-text-sm'>
                Edit price: <input type="text" value={product.price}
                onChange={e => {
                    const copy = [...products]
                    copy[i].price = e.target.value
                    setProducts(copy)
                }} />
            </div>
        </div>
    )}
    getNewItem={() => ({
        name: \`Product \${products.length + 1}\`,
        description: \`Description for Product \${products.length + 1}\`,
        price: '$' + Number(Math.random() * 10).toFixed(2)
    })}
/>`}</CodeBlock>
                <ItemList
                    params={products}
                    label='Product'
                    onChange={list => setProducts([...list])}
                    emptyMsg="No products available"
                    renderItem={(product, i) => (
                        <div className="cp-param-list-col py-2">
                            <h6>{product.name}</h6>
                            <p className='cp-text-sm cp-text-txt-7'>{product.description}</p>
                            <div className='cp-text-sm'>
                                Edit price: <input type="text" value={product.price} onChange={e => {
                                    const copy = [...products]
                                    copy[i].price = e.target.value
                                    setProducts(copy)
                                }} />
                            </div>
                        </div>
                    )}
                    getNewItem={() => ({
                        name: `Product ${products.length + 1}`,
                        description: `Description for Product ${products.length + 1}`,
                        price: '$' + Number(Math.random() * 10).toFixed(2)
                    })}
                />
                <CodeBlock language="ts">{`// Current value:\n${JSON.stringify(products, null, 2)}`}</CodeBlock>
            </article>

            <article className="mb-12">
                <h3 className="mb-2">Notes</h3>
                <ul className="cp-text-txt-5" style={{ paddingLeft: '1.2em', listStyle: 'disc' }}>
                    <li className="mb-2">
                        Rows are keyed by index, so removing an item re-keys everything below it.
                        Uncontrolled state inside a row: focus, a collapsed section, an
                        uncontrolled input, moves up a row when the one above is deleted.
                    </li>
                    <li className="mb-2">
                        No reordering, no minimum or maximum length, no duplicate check, and no
                        confirmation before removing. The remove button acts immediately.
                    </li>
                </ul>
            </article>
        </section>
    );
}
