import { Collapse }      from '../../components/Collapse';
import { JsonViewer }    from '../../components/JsonViewer';
import { Sparkline }     from '../../components/Sparkline';
import { Button, Badge } from '../../index';
import { Tab, TabBar, TabContents, Tabs, TabsBody } from '../../components/Tabs';


export function BasicComponentsPage() {
  return (
    <section className="">
      <header className="text-sky-500 uppercase mb-8">Basic Components</header>

      <div className="flex flex-wrap gap-8">
        <article>
          <h3>Badge</h3>
          <table style={{ borderSpacing: '0.5rem' }}>
            <tbody>
              <tr>
                <td><Badge variant="danger">Danger</Badge></td>
                <td><code> &lt;Badge variant="danger"&gt;Danger&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="warning">Warning</Badge></td>
                <td><code> &lt;Badge variant="warning"&gt;Warning&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="success">Success</Badge></td>
                <td><code> &lt;Badge variant="success"&gt;Success&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="info">Info</Badge></td>
                <td><code> &lt;Badge variant="info"&gt;Info&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="link">Link</Badge></td>
                <td><code> &lt;Badge variant="link"&gt;Link&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="neutral">Neutral</Badge></td>
                <td><code> &lt;Badge variant="neutral"&gt;Neutral&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge>Default</Badge></td>
                <td><code> &lt;Badge&gt;Default&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="muted">Muted</Badge></td>
                <td><code> &lt;Badge variant="muted"&gt;Muted&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="danger" hard>Red Hard</Badge></td>
                <td><code> &lt;Badge variant="danger" hard&gt;Red Hard&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="warning" hard>Warning Hard</Badge></td>
                <td><code> &lt;Badge variant="warning" hard&gt;Warning Hard&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="success" hard>Success Hard</Badge></td>
                <td><code> &lt;Badge variant="success" hard&gt;Success Hard&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="info" hard>Info Hard</Badge></td>
                <td><code> &lt;Badge variant="info" hard&gt;Info Hard&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="link" hard>Link Hard</Badge></td>
                <td><code> &lt;Badge variant="link" hard&gt;Link Hard&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="muted" hard>Muted Hard</Badge></td>
                <td><code> &lt;Badge variant="muted" hard&gt;Muted Hard&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge variant="neutral" hard>Neutral Hard</Badge></td>
                <td><code> &lt;Badge variant="neutral" hard&gt;Neutral Hard&lt;/Badge&gt;</code></td>
              </tr>
              <tr>
                <td><Badge hard>Default Hard</Badge></td>
                <td><code> &lt;Badge hard&gt;Default Hard&lt;/Badge&gt;</code></td>
              </tr>
            </tbody>
          </table>
        </article>

        <article>
          <h3>Button</h3>
          <table style={{ borderSpacing: '0.5rem' }}>
            <tbody>
              <tr>
                <td><Button variant="danger" className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="danger"&gt;Danger&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="warning" className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="warning"&gt;Warning&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="success" className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="success"&gt;Success&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="info" className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="info"&gt;Info&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="link" className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="link"&gt;Link&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="neutral" className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="neutral"&gt;Neutral&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button&gt;Default&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="muted" className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="muted"&gt;Muted&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="danger" hard className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="danger" hard&gt;Button&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="warning" hard className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="warning" hard&gt;Button&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="success" hard className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="success" hard&gt;Button&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="info" hard className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="info" hard&gt;Button&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="link" hard className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="link" hard&gt;Button&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="muted" hard className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="muted" hard&gt;Button&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button variant="neutral" hard className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button variant="neutral" hard&gt;Button&lt;/Button&gt;</code></td>
              </tr>
              <tr>
                <td><Button hard className="cp-px-4 cp-py-3">Button</Button></td>
                <td><code> &lt;Button hard&gt;Button&lt;/Button&gt;</code></td>
              </tr>
            </tbody>
          </table>
        </article>

        <article>
          <h3>Border Radius</h3>
          <table style={{ borderSpacing: '0.5rem' }}>
            <tbody>
              <tr>
                <td><div className='cp-rounded-full bg-blue-500 text-white px-4 py-2 text-center'>.cp-rounded-full</div></td>
              </tr>
              <tr>
                <td><div className='cp-rounded-pill bg-blue-500 text-white px-4 py-2 text-center'>.cp-rounded-pill</div></td>
              </tr>
              <tr>
                <td><div className='cp-rounded-lg bg-blue-500 text-white px-4 py-2 text-center'>.cp-rounded-lg</div></td>
              </tr>
              <tr>
                <td><div className='cp-rounded-md bg-blue-500 text-white px-4 py-2 text-center'>.cp-rounded-md</div></td>
              </tr>
              <tr>
                <td><div className='cp-rounded-sm bg-blue-500 text-white px-4 py-2 text-center'>.cp-rounded-sm</div></td>
              </tr>
              <tr>
                <td><div className='cp-rounded-none bg-blue-500 text-white px-4 py-2 text-center'>.cp-rounded-none</div></td>
              </tr>
            </tbody>
          </table>
        </article>

        <article>
          <h3>Fill Colors</h3>
          <div className="flex flex-wrap gap-4">
            <div className="cp-fill-red cp-border-danger rounded p-3 text-white">.cp-fill-red</div>
            <div className="cp-fill-amber cp-border-warning rounded p-3 text-white">.cp-fill-amber</div>
            <div className="cp-fill-yellow cp-border-warning rounded p-3">.cp-fill-yellow</div>
            <div className="cp-fill-green cp-border-success rounded p-3 text-white">.cp-fill-green</div>
            <div className="cp-fill-teal cp-border-info rounded p-3 text-white">.cp-fill-teal</div>
            <div className="cp-fill-blue cp-border-info rounded p-3 text-white">.cp-fill-blue</div>
            <div className="cp-fill-purple cp-border-info rounded p-3 text-white">.cp-fill-purple</div>
            <div className="cp-fill-gray cp-border-neutral rounded p-3 text-white">.cp-fill-gray</div>
            <div className="cp-fill-white cp-border-neutral rounded p-3 text-black">.cp-fill-white</div>
            <div className="cp-fill-black cp-border-neutral rounded p-3 text-white">.cp-fill-black</div>
          </div>
        </article>

        <article>
          <h3>Fill Opacity</h3>
          <div className="flex flex-wrap gap-4">
            <div className="cp-fill-red cp-fill-opacity-10 cp-border-danger rounded p-3">.cp-fill-opacity-10</div>
            <div className="cp-fill-red cp-fill-opacity-20 cp-border-danger rounded p-3">.cp-fill-opacity-20</div>
            <div className="cp-fill-red cp-fill-opacity-30 cp-border-danger rounded p-3">.cp-fill-opacity-30</div>
            <div className="cp-fill-red cp-fill-opacity-40 cp-border-danger rounded p-3">.cp-fill-opacity-40</div>
            <div className="cp-fill-red cp-fill-opacity-50 cp-border-danger rounded p-3">.cp-fill-opacity-50</div>
            <div className="cp-fill-red cp-fill-opacity-60 cp-border-danger rounded p-3 text-white">.cp-fill-opacity-60</div>
            <div className="cp-fill-red cp-fill-opacity-70 cp-border-danger rounded p-3 text-white">.cp-fill-opacity-70</div>
            <div className="cp-fill-red cp-fill-opacity-80 cp-border-danger rounded p-3 text-white">.cp-fill-opacity-80</div>
            <div className="cp-fill-red cp-fill-opacity-90 cp-border-danger rounded p-3 text-white">.cp-fill-opacity-90</div>
            <div className="cp-fill-red cp-fill-opacity-100 cp-border-danger rounded p-3 text-white">.cp-fill-opacity-100</div>
          </div>
        </article>

        <article>
          <h3>Border Colors</h3>
          <div className="flex flex-wrap gap-4">
            <div className="border-solid cp-border-red rounded p-3">.cp-border-red</div>
            <div className="border-solid cp-border-amber rounded p-3">.cp-border-amber</div>
            <div className="border-solid cp-border-yellow rounded p-3">.cp-border-yellow</div>
            <div className="border-solid cp-border-green rounded p-3">.cp-border-green</div>
            <div className="border-solid cp-border-teal rounded p-3">.cp-border-teal</div>
            <div className="border-solid cp-border-blue rounded p-3">.cp-border-blue</div>
            <div className="border-solid cp-border-purple rounded p-3">.cp-border-purple</div>
            <div className="border-solid cp-border-gray rounded p-3">.cp-border-gray</div>
            <div className="border-solid cp-border-white rounded p-3">.cp-border-white</div>
            <div className="border-solid cp-border-black rounded p-3">.cp-border-black</div>
          </div>
        </article>

        <article>
          <h3>Border Opacity</h3>
          <div className="flex flex-wrap gap-4">
            <div className="border-solid cp-border-red cp-border-opacity-10 rounded p-3">.cp-border-opacity-10</div>
            <div className="border-solid cp-border-red cp-border-opacity-20 rounded p-3">.cp-border-opacity-20</div>
            <div className="border-solid cp-border-red cp-border-opacity-30 rounded p-3">.cp-border-opacity-30</div>
            <div className="border-solid cp-border-red cp-border-opacity-40 rounded p-3">.cp-border-opacity-40</div>
            <div className="border-solid cp-border-red cp-border-opacity-50 rounded p-3">.cp-border-opacity-50</div>
            <div className="border-solid cp-border-red cp-border-opacity-60 rounded p-3">.cp-border-opacity-60</div>
            <div className="border-solid cp-border-red cp-border-opacity-70 rounded p-3">.cp-border-opacity-70</div>
            <div className="border-solid cp-border-red cp-border-opacity-80 rounded p-3">.cp-border-opacity-80</div>
            <div className="border-solid cp-border-red cp-border-opacity-90 rounded p-3">.cp-border-opacity-90</div>
            <div className="border-solid cp-border-red cp-border-opacity-100 rounded p-3">.cp-border-opacity-100</div>
          </div>
        </article>

        <article>
          <h3>Text Colors</h3>
          <div className="flex flex-wrap gap-4">
            <div className="cp-text-red">.cp-text-red</div>
            <div className="cp-text-amber">.cp-text-amber</div>
            <div className="cp-text-yellow">.cp-text-yellow</div>
            <div className="cp-text-green">.cp-text-green</div>
            <div className="cp-text-teal">.cp-text-teal</div>
            <div className="cp-text-blue">.cp-text-blue</div>
            <div className="cp-text-purple">.cp-text-purple</div>
            <div className="cp-text-gray bg-[#8888]">.cp-text-gray</div>
            <div className="cp-text-white bg-[#8888]">.cp-text-white</div>
            <div className="cp-text-black bg-[#8888]">.cp-text-black</div>
          </div>
        </article>

        <article>
          <h3>Text Opacity</h3>
          <div className="flex flex-wrap gap-4">
            <div className="cp-text-txt cp-text-opacity-10">.cp-text-opacity-10</div>
            <div className="cp-text-txt cp-text-opacity-20">.cp-text-opacity-20</div>
            <div className="cp-text-txt cp-text-opacity-30">.cp-text-opacity-30</div>
            <div className="cp-text-txt cp-text-opacity-40">.cp-text-opacity-40</div>
            <div className="cp-text-txt cp-text-opacity-50">.cp-text-opacity-50</div>
            <div className="cp-text-txt cp-text-opacity-60">.cp-text-opacity-60</div>
            <div className="cp-text-txt cp-text-opacity-70">.cp-text-opacity-70</div>
            <div className="cp-text-txt cp-text-opacity-80">.cp-text-opacity-80</div>
            <div className="cp-text-txt cp-text-opacity-90">.cp-text-opacity-90</div>
            <div className="cp-text-txt cp-text-opacity-100">.cp-text-opacity-100</div>
          </div>
        </article>

        <article>
          <h3>Tabs</h3>
          <div className="flex flex-wrap gap-4">
            <Tabs defaultIndex={1}>
              <TabBar>
                  <Tab>Tab 1</Tab>
                  <Tab>Tab 2</Tab>
                  <Tab>Tab 3</Tab>
              </TabBar>
              <TabsBody className="p-4">
                  <TabContents>Content for Tab 1</TabContents>
                  <TabContents>Content for Tab 2</TabContents>
                  <TabContents>Content for Tab 3</TabContents>
              </TabsBody>
            </Tabs>
            <br/>
            <div className="border border-solid cp-border-win-3 rounded-lg overflow-hidden">
              <Tabs defaultIndex={1}>
                <TabBar className="cp-fill-win-1">
                    <Tab>Tab 1</Tab>
                    <Tab>Tab 2</Tab>
                    <Tab>Tab 3</Tab>
                </TabBar>
                <TabsBody className="p-4">
                    <TabContents>Content for Tab 1</TabContents>
                    <TabContents>Content for Tab 2</TabContents>
                    <TabContents>Content for Tab 3</TabContents>
                </TabsBody>
              </Tabs>
            </div>
          </div>
        </article>
      </div>

      <article>
          <h3>Sparkline</h3>
          <div className="flex gap-8 items-start flex-wrap">
            <div className="border border-solid cp-border-win-3 rounded-lg overflow-hidden cp-fill-win-1 overflow-hidden flex-1 min-w-[300px]">
              <div className="p-2 font-bold cp-text-txt-4">
                Minimal Example
              </div>
              <Tabs>
                <TabBar>
                    <Tab>Chart</Tab>
                    <Tab>Code</Tab>
                </TabBar>
                <TabsBody className="cp-fill-win">
                    <TabContents className="p-4">
                      <Sparkline
                        series={[
                          {
                            points: '1,0.1 2,0.8 5,0.5 8,0.7 10,0.2 11,0.2 12,0.3 13,0.2 14,0.2 15,0.4 16,0.2 17,0.5 18,0.92 19,0.4 22,0.5',
                          }
                        ]}
                      />
                    </TabContents>
                    <TabContents className="overflow-auto text-xs px-2">
                      <pre children={`<Sparkline series={[{points: '1,0.1 2,0.8 ...'}]} />`} />
                    </TabContents>
                </TabsBody>
              </Tabs>
            </div>

            <div className="border border-solid cp-border-win-3 rounded-lg overflow-hidden cp-fill-win-1 overflow-hidden flex-1 min-w-[300px]">
              <div className="p-2 font-bold cp-text-txt-4">
                Color, Dot, and Baseline
              </div>
              <Tabs>
                <TabBar>
                    <Tab>Chart</Tab>
                    <Tab>Code</Tab>
                </TabBar>
                <TabsBody className="cp-fill-win">
                    <TabContents className="p-4">
                      <Sparkline
                        series={[
                          {
                            color   : '#06C',
                            points  : '1,0.1 2,0.8 5,0.5 8,0.7 10,0.2 11,0.2 12,0.3 13,0.2 14,0.2 15,0.4 16,0.2 17,0.5 18,0.92 19,0.4 22,0.5',
                            dot     : { x: 22, y: 0.5, r: 5 },
                            range   : 0.5,
                            lineWidth: 3,
                          },
                        ]}
                      />
                    </TabContents>
                    <TabContents className="overflow-auto text-xs px-2">
                      <pre children={`<Sparkline
  series={[{
    color: '#06C',
    points: '1,0.1 2,0.8 ...',
    dot: { x: 22, y: 0.5, r: 5 },
    range: 0.5,
    lineWidth: 3
  }]}
/>`} />
                    </TabContents>
                </TabsBody>
              </Tabs>
            </div>


            <div className="border border-solid cp-border-win-3 rounded-lg overflow-hidden cp-fill-win-1 flex-1 min-w-[300px]">
              <div className="p-2 font-bold cp-text-txt-4">
                Range and Auto-color
              </div>
              <Tabs>
                <TabBar className="cp-fill-win-1">
                    <Tab>Chart</Tab>
                    <Tab>Code</Tab>
                </TabBar>
                <TabsBody>
                    <TabContents className="p-4">
                      <Sparkline
                        series={[
                          {
                            points  : '2,0.8 5,0.5 8,0.7 10,0.2 11,0.2 12,0.3 13,0.2 14,0.2 15,0.4 16,0.2 17,0.5 18,0.92 19,0.4 20,0.2 21,0.3 22,0.34 23,0.35',
                            dot     : { x: 20, y: 0.2, r: 3 },
                            range   : [0.45, 0.6],
                          },
                        ]}
                      />
                    </TabContents>
                    <TabContents className="overflow-auto text-xs px-2">
                      <pre children={`<Sparkline
  series={[{
    points: '2,0.8 5,0.5 ...',
    dot: { x: 20, y: 0.2, r: 3 },
    range: [0.45, 0.6]
  }]}
/>`} />
                    </TabContents>
                </TabsBody>
              </Tabs>
            </div>

            <div className="border border-solid cp-border-win-3 rounded-lg overflow-hidden cp-fill-win-1 flex-1 min-w-[300px]">
              <div className="p-2 font-bold cp-text-txt-4">
                Aspect Ratio and Label
              </div>
              <Tabs>
                <TabBar className="cp-fill-win-1">
                    <Tab>Chart</Tab>
                    <Tab>Code</Tab>
                </TabBar>
                <TabsBody>
                  <TabContents className="p-4">
                    <Sparkline
                      series={[
                        {
                          label : 'Label',
                          points: '1,0.1 2,0.8 5,0.5 8,0.7 10,0.2 11,0.2 12,0.3 13,0.2 14,0.2 15,0.4 16,0.2 17,0.5 18,0.92 19,0.4 20,0.2',
                          dot   : { x: 11, y: 0.2, r: 4 },
                          range : 0.5,
                          color : '#C0C'
                        },
                      ]}
                      aspectRatio={16/2}
                    />
                  </TabContents>
                  <TabContents className="overflow-auto text-xs px-2">
                    <pre children={`<Sparkline
  series={[{
    label: 'Label',
    points: '1,0.1 2,0.8 ...',
    dot: { x: 11, y: 0.2, r: 4 },
    range: 0.5
  }]}
  aspectRatio={16/2}
/>`} />
                  </TabContents>
                </TabsBody>
              </Tabs>
            </div>

            <div className="border border-solid cp-border-win-3 rounded-lg overflow-hidden cp-fill-win-1 flex-1 min-w-[300px]">
              <div className="p-2 font-bold cp-text-txt-4">
                Multiple Series Example
              </div>
              <Tabs>
                <TabBar className="cp-fill-win-1">
                    <Tab>Chart</Tab>
                    <Tab>Code</Tab>
                </TabBar>
                <TabsBody>
                  <TabContents className="p-4">
                    <Sparkline
                      series={[
                        {
                          label   : 'Label 1',
                          color   : 'var(--cp-color-amber)',
                          opacity : 1,
                          points  : '1,0.7 2,0.9 5,0.8 8,0.75 10,0.85 11,0.9 12,0.8 13,0.75 14,0.8 15,0.85 16,0.9 17,0.8, 18,0.75 19,0.8 20,0.85',
                          dot     : { x: 11, y: 0.9, r: 3 },
                          lineWidth: 1,
                        },
                        {
                          points  : '2,0.8 5,0.5 8,0.99 10,0.2 11,0.2 12,0.3 13,0.2 14,0.2 15,0.4 16,0.2 17,0.5 18,0.62 19,0.4 20,0.2',
                          dot     : { x: 20, y: 0.2, r: 3 },
                          range   : [0.45, 0.6],
                          label   : 'Label 2',
                          lineWidth: 1,
                        }
                      ]}
                      aspectRatio={16/2}
                    />
                  </TabContents>
                  <TabContents className="overflow-auto text-xs px-2">
                    <pre children={`<Sparkline
  series={[{
    color: 'var(--cp-color-amber)',
    points: '1,0.1 2,0.8 ...',
    dot: { x: 1, y: 0.1, r: 3 },
    lineWidth: 1,
    label: 'Label 1'
  },
  {
    points  : '2,0.8 5,0.5 ...',
    dot     : { x: 20, y: 0.2, r: 3 },
    range   : [0.45, 0.6],
    label   : 'Label 2',
    lineWidth: 1,
  }]}
  aspectRatio={16/2}
/>`} />
                  </TabContents>
                </TabsBody>
              </Tabs>
            </div>
          </div>
      </article>

      <article>
        <h3>Collapse</h3>
        <div className="border border-solid cp-border-win-3 rounded-lg overflow-hidden cp-fill-win-1 flex-1 max-w-[300px] p-4">
          <Collapse label={ <b>Click to Toggle</b> }>
            <p>
              This is the content of the collapse component.<br />
              It can contain any elements and will smoothly transition when toggled.
            </p>
            <p>
              You can use this component to hide and show content as needed,
              keeping your UI clean and organized.
            </p>
          </Collapse>
        </div>
      </article>

      <article>
        <h3>JSON Viewer</h3>
        <div className="border border-solid cp-border-win-3 rounded-lg overflow-hidden cp-fill-win-1 flex-1 max-w-[800px] p-4">
          <JsonViewer data={{
            name: "John Doe",
            age: 30,
            isAdmin: false,
            courses: ["HTML", "CSS", "JavaScript"],
            wife: null,
            details: {
              hobbies: ["reading", "gaming"],
              education: {
                degree: "Bachelor's",
                field: "Computer Science"
              }
            },
            birthday: new Date(1990, 5, 15),
            missingValue: undefined,
          } as any}></JsonViewer>
        </div>
      </article>
      <br />
      <br />
    </section>
    
  );
}